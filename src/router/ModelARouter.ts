/**
 * ModelARouter - Core message router for Model A
 * Pipeline: message → dedup → classify → route → execute → respond
 */

import * as crypto from 'node:crypto';
import { ExternalMessage, ExternalResponse, InterfaceLogger } from '../interface/types.js';
import {
  ClassifiedIntent,
  DedupEntry,
  ModelARouterInterface,
  RouteContext,
  RouteJob,
  RouteResult,
  RouteServices,
  RouterConfig,
  SmartRouterLike,
  DEFAULT_ROUTER_CONFIG,
  InlineKeyboardButton,
} from './types.js';
import { IntentClassifier } from './IntentClassifier.js';
import { RouteRegistry } from './RouteRegistry.js';
import { NotificationManager } from './notifications/NotificationManager.js';

const DEDUP_MAX_SIZE = 1000;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ModelARouter implements ModelARouterInterface {
  private logger: InterfaceLogger;
  private classifier: IntentClassifier;
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
  private voiceTranscriberFn: ((fileId: string) => Promise<string>) | null = null;

  constructor(logger: InterfaceLogger, config?: Partial<RouterConfig>) {
    this.logger = logger;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.classifier = new IntentClassifier(logger);
    this.registry = new RouteRegistry(logger);
    this.notificationManager = new NotificationManager(logger, this.config.notifications);
  }

  /** Set SmartRouter for LLM classification and conversation */
  setSmartRouter(router: SmartRouterLike): void {
    this.smartRouter = router;
    this.classifier.setSmartRouter(router);
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

  /** Set voice transcriber function (downloads file + STT) */
  setVoiceTranscriber(fn: (fileId: string) => Promise<string>): void {
    this.voiceTranscriberFn = fn;
  }

  /** Get route registry for route registration */
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
      // Step 2: Pre-process voice/file messages
      const processedContent = await this.preprocessMessage(message, correlationId);
      if (processedContent !== null) {
        message = { ...message, content: processedContent, type: 'text' };
      }

      // Step 3: Classify intent
      const intent = await this.classifier.classify(message.content);
      this.logger('info', `[${correlationId}] Intent: ${intent.category} (${intent.confidence})`);

      // Step 3: Handle conversation directly
      if (intent.category === 'conversation') {
        await this.handleConversation(message, intent, correlationId);
        return;
      }

      // Step 4: Handle composite (Phase 4 pending)
      if (intent.category === 'composite') {
        await this.handleCompositeNotReady(message);
        return;
      }

      // Step 5: Find matching route
      const route = this.registry.findRoute(intent);
      if (!route) {
        await this.sendText(message.chatId, `이 요청을 처리할 수 있는 라우트가 없습니다: ${intent.category}`);
        return;
      }

      // Step 6: Create job and execute
      const job = this.createJob();
      const context = this.buildContext(job, intent, message);
      const result = await route.execute(context);

      // Step 7: Send result
      await this.sendResult(message.chatId, result, correlationId);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger('error', `[${correlationId}] Pipeline error: ${error.message}`);
      await this.sendText(message.chatId, `오류가 발생했습니다: ${error.message}`);
    }
  }

  /** Handle conversation intent directly via SmartRouter */
  private async handleConversation(
    message: ExternalMessage,
    intent: ClassifiedIntent,
    correlationId: string,
  ): Promise<void> {
    if (!this.smartRouter) {
      await this.sendText(message.chatId, '대화 기능이 아직 설정되지 않았습니다.');
      return;
    }

    try {
      const result = await this.smartRouter.route({
        type: 'general',
        prompt: intent.rawQuery,
      });

      if (result.success) {
        await this.sendText(message.chatId, result.content, 'markdown');
      } else {
        await this.sendText(message.chatId, '응답을 생성하지 못했습니다.');
      }
    } catch (err) {
      this.logger('error', `[${correlationId}] Conversation error`, {
        error: err instanceof Error ? err.message : String(err),
      });
      await this.sendText(message.chatId, '대화 처리 중 오류가 발생했습니다.');
    }
  }

  /** Handle composite intent (not yet implemented in Phase 1) */
  private async handleCompositeNotReady(message: ExternalMessage): Promise<void> {
    await this.sendText(
      message.chatId,
      '복합 명령은 아직 지원하지 않습니다. 개별 명령으로 나누어 보내주세요.',
    );
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

  /** Create a minimal job */
  private createJob(): RouteJob {
    return {
      id: crypto.randomUUID(),
      status: 'executing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Build route context */
  private buildContext(
    job: RouteJob,
    intent: ClassifiedIntent,
    message: ExternalMessage,
  ): RouteContext {
    return {
      job,
      intent,
      message,
      chatId: message.chatId,
      userId: message.userId,
      services: this.buildServices(),
    };
  }

  /** Build services object for routes */
  private buildServices(): RouteServices {
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

  /** Send route result to user */
  private async sendResult(
    chatId: string,
    result: RouteResult,
    correlationId: string,
  ): Promise<void> {
    if (result.success) {
      const msg = result.data || '작업이 완료되었습니다.';
      await this.notificationManager.sendCompletion(chatId, `✅ ${msg}`);
    } else {
      const msg = result.error || '알 수 없는 오류가 발생했습니다.';
      await this.sendText(chatId, `❌ ${msg}`);
    }
    this.logger('info', `[${correlationId}] Result: ${result.success ? 'success' : 'failed'}`);
  }

  /** Pre-process voice/file messages before classification */
  private async preprocessMessage(
    message: ExternalMessage,
    correlationId: string,
  ): Promise<string | null> {
    // Voice message → transcribe to text
    if (message.type === 'voice' && message.metadata?.telegramFileId) {
      const fileId = String(message.metadata.telegramFileId);
      if (this.voiceTranscriberFn) {
        try {
          await this.sendText(message.chatId, '🎙️ 음성 메시지를 처리하고 있습니다...');
          const transcribed = await this.voiceTranscriberFn(fileId);
          this.logger('info', `[${correlationId}] Voice transcribed: "${transcribed.slice(0, 80)}"`);
          return transcribed;
        } catch (err) {
          this.logger('warn', `[${correlationId}] Voice transcription failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
          await this.sendText(message.chatId, '음성 인식에 실패했습니다. 텍스트로 다시 보내주세요.');
          return null;
        }
      }
      await this.sendText(message.chatId, '음성 메시지 처리가 설정되지 않았습니다. 텍스트로 보내주세요.');
      return null;
    }

    // File message → include file info in content for classification
    if (message.type === 'file' && message.metadata?.telegramFileId) {
      const fileName = message.content;
      const mimeType = String(message.metadata.fileMimeType || '');
      return `파일 분석 요청: ${fileName} (${mimeType})`;
    }

    return null;
  }
}
