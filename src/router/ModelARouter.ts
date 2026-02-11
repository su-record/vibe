/**
 * ModelARouter - Core message router for Model A
 * Pipeline: message → dedup → queue/process → AgentLoop.process()
 *
 * sonolbot-v2 Phase 2: Mid-task message queuing + injection
 * sonolbot-v2 Phase 3: Activity heartbeat + stale detection
 */

import * as crypto from 'node:crypto';
import { ExternalMessage, ExternalResponse, InterfaceLogger } from '../interface/types.js';
import {
  DedupEntry,
  ModelARouterInterface,
  RouteServices,
  RouterConfig,
  SmartRouterLike,
  DEFAULT_ROUTER_CONFIG,
  InlineKeyboardButton,
} from './types.js';
import { RouteRegistry } from './RouteRegistry.js';
import { NotificationManager } from './notifications/NotificationManager.js';
import type { AgentLoop } from '../agent/AgentLoop.js';
import type { AgentProgressEvent } from '../agent/types.js';
import { MESSAGING } from '../infra/lib/constants.js';

const DEDUP_MAX_SIZE = 1000;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Phase 2-3: Use centralized constants
const MAX_PENDING_MESSAGES = MESSAGING.MAX_PENDING_MESSAGES;
const PENDING_MESSAGE_TTL_MS = MESSAGING.PENDING_MESSAGE_TTL_MS;
const ACK_DEBOUNCE_MS = MESSAGING.ACK_DEBOUNCE_MS;
const ACTIVITY_TIMEOUT_MS = MESSAGING.ACTIVITY_TIMEOUT_MS;
const STALE_CHECK_INTERVAL_MS = MESSAGING.STALE_CHECK_INTERVAL_MS;
const MAX_STALE_RETRY = MESSAGING.MAX_STALE_RETRY;

type PendingMessage = ExternalMessage & {
  _retryCount?: number;
  _queuedAt: number;
};

interface ProcessingInfo {
  startedAt: number;
  lastActivity: number;
}

export class ModelARouter implements ModelARouterInterface {
  private logger: InterfaceLogger;
  private registry: RouteRegistry;
  private notificationManager: NotificationManager;
  private config: RouterConfig;
  private smartRouter: SmartRouterLike | null = null;
  private dedupCache: Map<number, DedupEntry> = new Map();
  private sendResponseFn: ((response: ExternalResponse) => Promise<void>) | null = null;
  private sendInlineKeyboardFn: ((
    chatId: string,
    text: string,
    buttons: InlineKeyboardButton[][],
  ) => Promise<number | undefined>) | null = null;
  private callbackHandlers: Map<string, (data: string) => void> = new Map();
  private agentLoop: AgentLoop | null = null;

  // Phase 2: Processing and queue state
  private processingChats: Map<string, ProcessingInfo> = new Map();
  private pendingMessages: Map<string, PendingMessage[]> = new Map();
  private ackTimestamps: Map<string, number> = new Map();

  // Phase 3: Stale detection
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logger: InterfaceLogger, config?: Partial<RouterConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.registry = new RouteRegistry(logger);
    this.notificationManager = new NotificationManager(logger, this.config.notifications);
    this.startStaleChecker();
  }

  /** Set SmartRouter (used by external services) */
  setSmartRouter(router: SmartRouterLike): void {
    this.smartRouter = router;
  }

  /** Get SmartRouter instance */
  getSmartRouter(): SmartRouterLike {
    if (!this.smartRouter) {
      throw new Error('SmartRouter not initialized');
    }
    return this.smartRouter;
  }

  /** Set Telegram send function */
  setSendResponse(fn: (response: ExternalResponse) => Promise<void>): void {
    this.sendResponseFn = fn;
  }

  /** Set inline keyboard send function */
  setSendInlineKeyboard(fn: (
    chatId: string,
    text: string,
    buttons: InlineKeyboardButton[][],
  ) => Promise<number | undefined>): void {
    this.sendInlineKeyboardFn = fn;
  }

  /** Handle a callback query from inline keyboard */
  handleCallbackQuery(chatId: string, data: string): void {
    const handler = this.callbackHandlers.get(chatId);
    if (handler) {
      handler(data);
    } else {
      this.logger('debug', `No callback handler for chat ${chatId}`);
    }
  }

  /** Set AgentLoop for function-calling based message handling */
  setAgentLoop(agentLoop: AgentLoop): void {
    this.agentLoop = agentLoop;
    agentLoop.setLogger(this.logger);
  }

  /** Get AgentLoop instance */
  getAgentLoop(): AgentLoop | null {
    return this.agentLoop;
  }

  /** Get route registry (bridge compatibility) */
  getRegistry(): RouteRegistry {
    return this.registry;
  }

  /** Get notification manager */
  getNotificationManager(): NotificationManager {
    return this.notificationManager;
  }

  /** Get current config */
  getConfig(): RouterConfig {
    return this.config;
  }

  /** Phase 3: Handle progress event — update lastActivity */
  handleProgressEvent(event: AgentProgressEvent): void {
    if (event.type === 'job:created' && event.data.kind === 'created') {
      const info = this.processingChats.get(event.data.chatId);
      if (info) {
        info.lastActivity = Date.now();
      }
    } else if (event.type === 'job:progress') {
      // Update all processing chats' lastActivity on any progress
      for (const info of this.processingChats.values()) {
        info.lastActivity = Date.now();
      }
    }
  }

  /** Main message handling pipeline */
  async handleMessage(message: ExternalMessage): Promise<void> {
    const { chatId } = message;
    const correlationId = `${chatId}:${Date.now()}`;
    this.logger('info', `[${correlationId}] Message received: "${message.content.slice(0, 80)}"`);

    // Step 1: Dedup check
    const updateId = this.extractUpdateId(message);
    if (updateId !== null && this.isDuplicate(updateId)) {
      this.logger('debug', `[${correlationId}] Duplicate message ignored (update_id: ${updateId})`);
      return;
    }

    if (!this.agentLoop) {
      await this.sendText(chatId, '에이전트가 초기화되지 않았습니다.');
      return;
    }

    // Phase 2: If already processing for this chatId → queue
    if (this.processingChats.has(chatId)) {
      await this.queuePendingMessage(chatId, message);
      return;
    }

    // Start processing
    await this.startProcessing(chatId, message);
  }

  /** Phase 2: Queue a pending message for a chatId that's already processing */
  private async queuePendingMessage(
    chatId: string,
    message: ExternalMessage,
  ): Promise<void> {
    const queue = this.pendingMessages.get(chatId) ?? [];

    // Preprocess attachments before queuing (C1)
    let processedMessage = message;
    if (message.files?.length && this.agentLoop) {
      try {
        const preprocessor = this.agentLoop.getMediaPreprocessor();
        const sendFn = (cid: string, text: string): Promise<void> =>
          this.sendText(cid, text);
        const result = await preprocessor.preprocess(message, sendFn);
        if (result.success && result.transcribedText) {
          processedMessage = {
            ...message,
            content: result.transcribedText,
            files: undefined,
          };
        }
      } catch (err) {
        this.logger('warn', `Pending message preprocessing failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const pending: PendingMessage = {
      ...processedMessage,
      _queuedAt: Date.now(),
    };

    // Per-chat limit: FIFO evict oldest if over limit
    if (queue.length >= MAX_PENDING_MESSAGES) {
      queue.shift();
    }
    queue.push(pending);
    this.pendingMessages.set(chatId, queue);

    // Debounced ACK notification
    const lastAck = this.ackTimestamps.get(chatId) ?? 0;
    if (Date.now() - lastAck >= ACK_DEBOUNCE_MS) {
      await this.sendText(chatId, '✅ 새 요청 확인');
      this.ackTimestamps.set(chatId, Date.now());
    }

    this.logger('info', `Message queued for ${chatId} (${queue.length} pending)`);
  }

  /** Phase 2: Start processing a message with queue drain support */
  private async startProcessing(
    chatId: string,
    message: ExternalMessage,
  ): Promise<void> {
    this.processingChats.set(chatId, {
      startedAt: Date.now(),
      lastActivity: Date.now(),
    });

    try {
      const drainFn = (): ExternalMessage[] => this.drainPendingMessages(chatId);
      await this.agentLoop!.process(message, this.buildServices(), drainFn);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger('error', `Pipeline error for ${chatId}: ${error.message}`);
      await this.sendText(chatId, `오류가 발생했습니다: ${error.message}`);
    } finally {
      this.processingChats.delete(chatId);
      this.ackTimestamps.delete(chatId);
    }

    // Phase 2-3: Process remaining pending messages
    const remaining = this.pendingMessages.get(chatId);
    if (remaining && remaining.length > 0) {
      const nextMessage = remaining.shift()!;
      if (remaining.length === 0) {
        this.pendingMessages.delete(chatId);
      }
      // Re-queue the remaining messages so they'll be drained during the next process
      await this.startProcessing(chatId, nextMessage);
    }
  }

  /** Phase 2: Drain pending messages for a chatId (called by AgentLoop) */
  drainPendingMessages(chatId: string): ExternalMessage[] {
    const queue = this.pendingMessages.get(chatId);
    if (!queue || queue.length === 0) return [];

    const now = Date.now();
    const valid: ExternalMessage[] = [];

    // Filter by TTL and collect valid messages
    for (const msg of queue) {
      if (now - msg._queuedAt <= PENDING_MESSAGE_TTL_MS) {
        valid.push(msg);
      }
    }

    // Clear the queue
    this.pendingMessages.delete(chatId);
    return valid;
  }

  /** Phase 3: Start stale process checker */
  private startStaleChecker(): void {
    this.staleCheckTimer = setInterval(
      () => this.checkStaleProcesses(),
      STALE_CHECK_INTERVAL_MS,
    );
  }

  /** Phase 3: Check and clean up stale processes */
  private async checkStaleProcesses(): Promise<void> {
    const now = Date.now();
    const staleEntries: Array<[string, ProcessingInfo]> = [];

    for (const [chatId, info] of this.processingChats) {
      if (now - info.lastActivity > ACTIVITY_TIMEOUT_MS) {
        staleEntries.push([chatId, info]);
      }
    }

    // Process stale entries sequentially
    for (const [chatId] of staleEntries) {
      this.logger('warn', `Stale process detected for ${chatId}, cleaning up`);
      this.processingChats.delete(chatId);

      await this.sendText(
        chatId,
        '⚠️ 작업이 응답 없이 10분 경과하여 자동 종료되었습니다',
      );

      // Auto-reprocess pending messages (with retry limit)
      const pending = this.pendingMessages.get(chatId);
      if (pending && pending.length > 0) {
        const next = pending[0];
        const retryCount = next._retryCount ?? 0;

        if (retryCount < MAX_STALE_RETRY) {
          next._retryCount = retryCount + 1;
          this.pendingMessages.delete(chatId);
          await this.startProcessing(chatId, next);
        } else {
          this.pendingMessages.delete(chatId);
          await this.sendText(
            chatId,
            '⚠️ 반복 실패로 요청을 건너뛰었습니다. 다시 보내주세요.',
          );
        }
      }
    }
  }

  /** Phase 3: Dispose — clean up timers and state */
  dispose(): void {
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    this.processingChats.clear();
    this.pendingMessages.clear();
    this.ackTimestamps.clear();
  }

  /** Check for duplicate update_id */
  private isDuplicate(updateId: number): boolean {
    if (this.dedupCache.has(updateId)) return true;

    this.dedupCache.set(updateId, { updateId, processedAt: Date.now() });
    this.pruneDedup();
    return false;
  }

  /** Prune old dedup entries */
  private pruneDedup(): void {
    if (this.dedupCache.size <= DEDUP_MAX_SIZE) return;

    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [id, entry] of this.dedupCache) {
      if (entry.processedAt < cutoff) {
        this.dedupCache.delete(id);
      }
    }
  }

  /** Extract Telegram update_id from message metadata */
  private extractUpdateId(message: ExternalMessage): number | null {
    const mid = message.metadata?.telegramMessageId;
    if (typeof mid === 'string' || typeof mid === 'number') {
      return Number(mid);
    }
    return null;
  }

  /** Build services object for agent and routes */
  buildServices(): RouteServices {
    return {
      logger: this.logger,
      sendTelegram: (chatId, text, options) => this.sendText(chatId, text, options?.format),
      sendTelegramInlineKeyboard: (chatId, text, buttons) => this.sendInlineKeyboard(chatId, text, buttons),
      registerCallbackHandler: (chatId, handler) => { this.callbackHandlers.set(chatId, handler); },
      unregisterCallbackHandler: (chatId) => { this.callbackHandlers.delete(chatId); },
      router: this,
      config: this.config,
    };
  }

  /** Send text message to Telegram */
  private async sendText(
    chatId: string,
    text: string,
    format: 'text' | 'markdown' | 'html' = 'text',
  ): Promise<void> {
    if (!this.sendResponseFn) return;

    const response: ExternalResponse = {
      messageId: crypto.randomUUID(),
      channel: 'telegram',
      chatId,
      content: text,
      format,
    };

    await this.sendResponseFn(response);
  }

  /** Send inline keyboard to Telegram */
  private async sendInlineKeyboard(
    chatId: string,
    text: string,
    buttons: InlineKeyboardButton[][],
  ): Promise<number | undefined> {
    if (!this.sendInlineKeyboardFn) return undefined;
    return this.sendInlineKeyboardFn(chatId, text, buttons);
  }
}
