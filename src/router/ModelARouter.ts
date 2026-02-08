/**
 * ModelARouter - Core message router for Model A
 * Pipeline: message → dedup → AgentLoop.process()
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

const DEDUP_MAX_SIZE = 1000;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  constructor(logger: InterfaceLogger, config?: Partial<RouterConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.registry = new RouteRegistry(logger);
    this.notificationManager = new NotificationManager(logger, this.config.notifications);
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

  /** Main message handling pipeline */
  async handleMessage(message: ExternalMessage): Promise<void> {
    const correlationId = `${message.chatId}:${Date.now()}`;
    this.logger('info', `[${correlationId}] Message received: "${message.content.slice(0, 80)}"`);

    // Step 1: Dedup check
    const updateId = this.extractUpdateId(message);
    if (updateId !== null && this.isDuplicate(updateId)) {
      this.logger('debug', `[${correlationId}] Duplicate message ignored (update_id: ${updateId})`);
      return;
    }

    try {
      // Step 2: Agent processes everything (voice/file/text)
      if (!this.agentLoop) {
        await this.sendText(message.chatId, '에이전트가 초기화되지 않았습니다.');
        return;
      }

      await this.agentLoop.process(message, this.buildServices());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger('error', `[${correlationId}] Pipeline error: ${error.message}`);
      await this.sendText(message.chatId, `오류가 발생했습니다: ${error.message}`);
    }
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
