/**
 * SessionPool - Claude Code Session Management
 * Phase 1: Agent Engine
 *
 * Features:
 * - Per-project session (max 1 per project)
 * - Global session limit (max 5)
 * - Idle session timeout (30 min)
 * - Session reuse (OAuth auth persistence)
 * - Serialized requests within same session (Promise chain mutex)
 * - Network error reconnection (max 3 retries, exponential backoff)
 * - AgentLoop integration: HeadModel → ToolExecutor → response pipeline
 * - 60s request timeout, max queue depth 5
 */

import { SessionInfo, DaemonConfig, LogLevel } from './types.js';
import type { ExternalMessage, ChannelType } from '../interface/types.js';
import type { RouteServices, InlineKeyboardButton } from '../router/types.js';
import type { ToolDefinition } from '../agent/types.js';
import type { HeadModelSelector } from '../agent/HeadModelSelector.js';
import { AgentLoop } from '../agent/AgentLoop.js';
import type { AgentProgressEvent } from '../agent/types.js';
import type { SessionRAGStore } from '../infra/lib/memory/SessionRAGStore.js';

const MAX_QUEUE_DEPTH = 5;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_PENDING_INSTRUCTIONS = 10;
const PENDING_TTL_MS = 5 * 60 * 1000; // 5분

interface QueuedRequest {
  message: string;
  chatId: string;
  channel: ChannelType;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

interface PendingInstruction {
  content: string;
  timestamp: number;
}

interface AgentDeps {
  headSelector: HeadModelSelector;
  tools: ToolDefinition[];
  ragStore?: SessionRAGStore;
}

export class SessionPool {
  private sessions: Map<string, SessionInfo> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private processing: Set<string> = new Set();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: DaemonConfig;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  /** Agent dependencies (set once by VibeDaemon) */
  private agentDeps: AgentDeps | null = null;

  /** Per-session AgentLoop instances (lazy initialized) */
  private agentLoops: Map<string, AgentLoop> = new Map();

  /** Collected response per request */
  private responseCollectors: Map<string, string> = new Map();

  /** Phase 4: Pending instructions per session */
  private pendingInstructions: Map<string, PendingInstruction[]> = new Map();

  constructor(
    config: DaemonConfig,
    logger: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.config = config;
    this.logger = logger;
  }

  /** Set agent dependencies (called by VibeDaemon after initialization) */
  setAgentDeps(deps: AgentDeps): void {
    this.agentDeps = deps;
    this.logger('info', `Agent deps set (${deps.tools.length} tools)`);
  }

  /** Start the session pool with idle cleanup timer */
  start(): void {
    // Run cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions();
    }, 5 * 60 * 1000);
    this.logger('info', 'Session pool started');
  }

  /** Stop all sessions and cleanup */
  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Close all sessions
    for (const [id, session] of this.sessions) {
      this.logger('info', `Closing session ${id} for ${session.projectPath}`);
    }
    this.sessions.clear();
    this.requestQueues.clear();
    this.processing.clear();
    this.agentLoops.clear();
    this.responseCollectors.clear();
    this.pendingInstructions.clear();
    this.logger('info', 'Session pool stopped');
  }

  /** Get or create a session for a project */
  getOrCreateSession(projectPath: string): SessionInfo {
    // Find existing session for this project
    for (const [, session] of this.sessions) {
      if (session.projectPath === projectPath && session.status !== 'error') {
        session.lastUsedAt = Date.now();
        this.logger('debug', `Reusing session ${session.id} for ${projectPath}`);
        return session;
      }
    }

    // Check global session limit
    if (this.sessions.size >= this.config.maxGlobalSessions) {
      // Evict oldest idle session
      const evicted = this.evictOldestIdle();
      if (!evicted) {
        throw new Error(
          `Session limit reached (${this.config.maxGlobalSessions}). All sessions are busy.`
        );
      }
    }

    // Create new session
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: SessionInfo = {
      id,
      projectPath,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      status: 'idle',
    };

    this.sessions.set(id, session);
    this.logger('info', `Created session ${id} for ${projectPath}`);
    return session;
  }

  /** Send a request to a session (serialized per-session) */
  async sendRequest(
    sessionId: string,
    message: string,
    chatId?: string,
    channel?: ChannelType,
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check queue depth
    const queue = this.requestQueues.get(sessionId) ?? [];
    if (queue.length >= MAX_QUEUE_DEPTH) {
      return '현재 처리 중인 요청이 많습니다. 잠시 후 다시 시도해주세요.';
    }

    return new Promise<string>((resolve, reject) => {
      // Add to request queue
      if (!this.requestQueues.has(sessionId)) {
        this.requestQueues.set(sessionId, []);
      }
      this.requestQueues.get(sessionId)!.push({
        message,
        chatId: chatId ?? sessionId,
        channel: channel ?? 'telegram',
        resolve,
        reject,
      });

      // Process queue if not already processing
      if (!this.processing.has(sessionId)) {
        this.processQueue(sessionId);
      }
    });
  }

  /** Get session info */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /** Get all active sessions */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /** Get active session count */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /** Phase 6: Find existing session by project path (O(1) scan, no I/O) */
  findSessionByProject(projectPath: string): SessionInfo | undefined {
    for (const [, session] of this.sessions) {
      if (session.projectPath === projectPath && session.status !== 'error') {
        return session;
      }
    }
    return undefined;
  }

  /** Phase 6: Check if any session has pending instructions */
  hasAnyPendingInstructions(): boolean {
    for (const [, queue] of this.pendingInstructions) {
      if (queue.length > 0) return true;
    }
    return false;
  }

  /** Phase 4: Add pending instruction for a busy session */
  addPendingInstruction(sessionId: string, content: string): boolean {
    const queue = this.pendingInstructions.get(sessionId) ?? [];
    if (queue.length >= MAX_PENDING_INSTRUCTIONS) {
      this.logger('warn', `Pending instruction queue full for session ${sessionId}`);
      return false;
    }
    queue.push({ content, timestamp: Date.now() });
    this.pendingInstructions.set(sessionId, queue);
    this.logger('info', `Added pending instruction for session ${sessionId} (${queue.length} total)`);
    return true;
  }

  /** Phase 4: Drain pending instructions (returns combined string or null) */
  drainPendingInstructions(sessionId: string): string | null {
    const queue = this.pendingInstructions.get(sessionId);
    if (!queue?.length) return null;

    const now = Date.now();
    // Filter out TTL-expired items
    const valid = queue.filter((item) => now - item.timestamp < PENDING_TTL_MS);
    this.pendingInstructions.delete(sessionId);

    if (valid.length === 0) return null;

    // Combine all pending instructions
    if (valid.length === 1) return valid[0].content;
    return valid.map((item, i) => `[추가 요청 ${i + 1}]\n${item.content}`).join('\n\n');
  }

  /** Phase 4: Check if session has pending instructions */
  hasPendingInstructions(sessionId: string): boolean {
    const queue = this.pendingInstructions.get(sessionId);
    return Boolean(queue?.length);
  }

  /** Close a specific session */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.requestQueues.delete(sessionId);
    this.processing.delete(sessionId);
    this.agentLoops.delete(sessionId);
    this.pendingInstructions.delete(sessionId);
    this.logger('info', `Closed session ${sessionId}`);
    return true;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private async processQueue(sessionId: string): Promise<void> {
    this.processing.add(sessionId);
    const queue = this.requestQueues.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (!queue || !session) {
      this.processing.delete(sessionId);
      return;
    }

    while (queue.length > 0) {
      const request = queue.shift()!;
      session.status = 'busy';
      session.lastUsedAt = Date.now();

      try {
        const result = await this.executeRequest(
          session,
          request.message,
          request.chatId,
          request.channel,
        );
        request.resolve(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        session.status = 'error';
        this.logger('error', `Session ${sessionId} request failed`, error.message);

        // Attempt reconnection
        const recovered = await this.attemptRecovery(session);
        if (!recovered) {
          request.reject(error);
          // Reject remaining queued requests
          while (queue.length > 0) {
            queue.shift()!.reject(new Error('Session failed and recovery unsuccessful'));
          }
          break;
        }
        // Retry the failed request once after recovery
        try {
          const result = await this.executeRequest(
            session,
            request.message,
            request.chatId,
            request.channel,
          );
          request.resolve(result);
        } catch (retryErr) {
          request.reject(retryErr instanceof Error ? retryErr : new Error(String(retryErr)));
        }
      }
    }

    if (session) {
      session.status = 'idle';
    }
    this.processing.delete(sessionId);
  }

  /** Get or create AgentLoop for a session */
  private getOrCreateAgentLoop(sessionId: string): AgentLoop {
    const existing = this.agentLoops.get(sessionId);
    if (existing) return existing;

    if (!this.agentDeps) {
      throw new Error('Agent dependencies not initialized. Call setAgentDeps() first.');
    }

    const agentLoop = new AgentLoop({
      headSelector: this.agentDeps.headSelector,
      tools: this.agentDeps.tools,
      systemPromptConfig: {
        userName: '사용자',
        language: 'ko',
        timezone: 'Asia/Seoul',
      },
    });
    agentLoop.setLogger(this.logger);

    this.agentLoops.set(sessionId, agentLoop);
    this.logger('info', `Created AgentLoop for session ${sessionId}`);
    return agentLoop;
  }

  /** Build minimal RouteServices for daemon context */
  private buildRouteServices(chatId: string, channel: ChannelType): RouteServices {
    const noop = async (): Promise<void> => {};
    const noopKeyboard = async (): Promise<number | undefined> => undefined;

    // Collect response text via sendTelegram (channel-agnostic in daemon context)
    const sendTelegram = async (_cid: string, text: string): Promise<void> => {
      const existing = this.responseCollectors.get(chatId) ?? '';
      this.responseCollectors.set(chatId, existing ? `${existing}\n${text}` : text);
    };

    const sendToChannel = async (
      _ch: ChannelType,
      _cid: string,
      text: string,
    ): Promise<void> => {
      const existing = this.responseCollectors.get(chatId) ?? '';
      this.responseCollectors.set(chatId, existing ? `${existing}\n${text}` : text);
    };

    return {
      logger: this.logger,
      sendTelegram,
      sendTelegramInlineKeyboard: noopKeyboard as (
        chatId: string,
        text: string,
        buttons: InlineKeyboardButton[][],
      ) => Promise<number | undefined>,
      registerCallbackHandler: () => {},
      unregisterCallbackHandler: () => {},
      router: {
        handleMessage: noop as (msg: ExternalMessage) => Promise<void>,
        getSmartRouter: () => ({
          route: async () => ({ content: '', success: false }),
        }),
      },
      config: {
        repos: { aliases: {}, basePaths: [] },
        qa: {
          autoApproveTools: [],
          maxWaitSeconds: 60,
          readOnTimeout: 'approve' as const,
          writeOnTimeout: 'deny' as const,
        },
        notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10_000 },
      },
      sendToChannel,
    };
  }

  private async executeRequest(
    session: SessionInfo,
    message: string,
    chatId: string,
    channel: ChannelType,
  ): Promise<string> {
    this.logger('debug', `Executing request in session ${session.id}: ${message.slice(0, 100)}`);

    // If no agent deps, fall back to STUB behavior
    if (!this.agentDeps) {
      this.logger('warn', 'Agent deps not set, returning stub response');
      return `[Session ${session.id}] Request received: ${message.slice(0, 50)}...`;
    }

    const agentLoop = this.getOrCreateAgentLoop(session.id);

    // Phase 4: Wire up pending instructions provider
    agentLoop.setPendingInstructionsProvider(() => {
      return this.drainPendingInstructions(session.id);
    });

    // Phase 5: Wire up conversation history callbacks
    if (this.agentDeps.ragStore) {
      const store = this.agentDeps.ragStore;
      agentLoop.setConversationHistoryCallbacks(
        (cid: string) => store.getRecentConversationHistory(cid),
        (cid: string, role: 'user' | 'assistant', content: string) =>
          store.saveConversationEntry(cid, role, content),
      );
    }

    // Build ExternalMessage
    const externalMessage: ExternalMessage = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channel,
      chatId,
      userId: chatId,
      content: message,
      type: 'text',
      timestamp: new Date().toISOString(),
    };

    // Build RouteServices
    const services = this.buildRouteServices(chatId, channel);

    // Clear response collector for this request
    this.responseCollectors.delete(chatId);

    // Set up onProgress to also capture responses
    agentLoop.setOnProgress((event: AgentProgressEvent) => {
      if (event.type === 'job:complete') {
        const data = event.data as { kind: string; content?: string };
        if (data.content) {
          this.responseCollectors.set(chatId, data.content);
        }
      }
    });

    // Execute with 60s timeout
    await Promise.race([
      agentLoop.process(externalMessage, services),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('요청 처리 시간이 초과되었습니다 (60초). 다시 시도해주세요.')),
          REQUEST_TIMEOUT_MS,
        );
      }),
    ]);

    // Collect response
    const response = this.responseCollectors.get(chatId);
    this.responseCollectors.delete(chatId);

    return response ?? '처리가 완료되었지만 응답이 없습니다.';
  }

  private async attemptRecovery(session: SessionInfo): Promise<boolean> {
    const maxRetries = this.config.sessionReconnectMaxRetries;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const backoffMs = Math.pow(2, attempt) * 1000; // exponential backoff
      this.logger(
        'info',
        `Recovery attempt ${attempt}/${maxRetries} for session ${session.id}, waiting ${backoffMs}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));

      try {
        // Reset agent loop for this session
        this.agentLoops.delete(session.id);
        session.status = 'idle';
        this.logger('info', `Session ${session.id} recovered on attempt ${attempt}`);
        return true;
      } catch {
        this.logger('warn', `Recovery attempt ${attempt} failed for session ${session.id}`);
      }
    }

    this.logger('error', `All recovery attempts failed for session ${session.id}`);
    return false;
  }

  private cleanupIdleSessions(): void {
    const now = Date.now();
    const timeout = this.config.idleSessionTimeoutMs;

    for (const [id, session] of this.sessions) {
      if (session.status === 'idle' && now - session.lastUsedAt > timeout) {
        this.logger('info', `Cleaning up idle session ${id} (idle for ${Math.round((now - session.lastUsedAt) / 1000)}s)`);
        this.sessions.delete(id);
        this.requestQueues.delete(id);
        this.agentLoops.delete(id);
        this.pendingInstructions.delete(id);
      }
    }
  }

  private evictOldestIdle(): boolean {
    let oldest: [string, SessionInfo] | null = null;

    for (const entry of this.sessions) {
      const [, session] = entry;
      if (session.status === 'idle') {
        if (!oldest || session.lastUsedAt < oldest[1].lastUsedAt) {
          oldest = entry;
        }
      }
    }

    if (oldest) {
      this.logger('info', `Evicting idle session ${oldest[0]}`);
      this.sessions.delete(oldest[0]);
      this.requestQueues.delete(oldest[0]);
      this.agentLoops.delete(oldest[0]);
      this.pendingInstructions.delete(oldest[0]);
      return true;
    }
    return false;
  }
}
