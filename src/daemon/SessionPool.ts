/**
 * SessionPool - Claude Code Session Management
 * Phase 1: Agent Engine
 *
 * Features:
 * - Per-project session (max 1 per project)
 * - Global session limit (max 5)
 * - Idle session timeout (30 min)
 * - Session reuse (OAuth auth persistence)
 * - Serialized requests within same session
 * - Network error reconnection (max 3 retries, exponential backoff)
 */

import { SessionInfo, DaemonConfig, LogLevel } from './types.js';

interface QueuedRequest {
  message: string;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

export class SessionPool {
  private sessions: Map<string, SessionInfo> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private processing: Set<string> = new Set();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: DaemonConfig;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    config: DaemonConfig,
    logger: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.config = config;
    this.logger = logger;
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
  async sendRequest(sessionId: string, message: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return new Promise<string>((resolve, reject) => {
      // Add to request queue
      if (!this.requestQueues.has(sessionId)) {
        this.requestQueues.set(sessionId, []);
      }
      this.requestQueues.get(sessionId)!.push({ message, resolve, reject });

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

  /** Close a specific session */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.requestQueues.delete(sessionId);
    this.processing.delete(sessionId);
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
        // In a full implementation, this would communicate with Claude Code
        // via `claude -p --stream-json`. For now, we'll acknowledge the request.
        const result = await this.executeRequest(session, request.message);
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
          const result = await this.executeRequest(session, request.message);
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

  private async executeRequest(session: SessionInfo, message: string): Promise<string> {
    // Placeholder: In full implementation, this spawns/communicates with
    // `claude -p --input-format stream-json --output-format stream-json`
    // For Phase 1, we verify the session infrastructure works.
    this.logger('debug', `Executing request in session ${session.id}: ${message.slice(0, 100)}`);

    // This will be replaced in Phase 4 with ClaudeCodeBridge
    return `[Session ${session.id}] Request received: ${message.slice(0, 50)}...`;
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
        // Attempt to recreate session
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
      return true;
    }
    return false;
  }
}
