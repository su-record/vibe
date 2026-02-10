/**
 * BaseInterface - Abstract class for external interfaces
 * Phase 4: External Interface
 *
 * All external interfaces (Telegram, Web, Webhook) extend this.
 * Phase 3: Multi-Message Batching (2s debounce per chat)
 */

import {
  ExternalInterface,
  ExternalMessage,
  ExternalResponse,
  ChannelType,
  InterfaceStatus,
  InterfaceInfo,
  InterfaceLogger,
} from './types.js';
import { combineMessages } from './utils/MessageCombiner.js';

const BATCH_WAIT_MS = 2000; // 2초 debounce
const MAX_BATCH_SIZE = 20;  // 최대 배치 크기

export type MessageHandler = (message: ExternalMessage) => Promise<void>;

export abstract class BaseInterface implements ExternalInterface {
  abstract readonly name: string;
  abstract readonly channel: ChannelType;

  protected status: InterfaceStatus = 'disabled';
  protected connectedAt?: string;
  protected lastActivity?: string;
  protected logger: InterfaceLogger;
  private messageHandler?: MessageHandler;

  /** Per-chat batching buffers (key: {channel}:{chatId}) */
  private messageBuffers: Map<string, ExternalMessage[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(logger: InterfaceLogger) {
    this.logger = logger;
  }

  /** Register handler for incoming messages */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /** Dispatch incoming message to handler (batched with 2s debounce) */
  protected async dispatchMessage(message: ExternalMessage): Promise<void> {
    this.lastActivity = new Date().toISOString();

    if (!this.messageHandler) {
      this.logger('warn', `No message handler registered for ${this.name}`);
      return;
    }

    const bufferKey = `${message.channel}:${message.chatId}`;

    // Push to buffer
    let buffer = this.messageBuffers.get(bufferKey);
    if (!buffer) {
      buffer = [];
      this.messageBuffers.set(bufferKey, buffer);
    }
    buffer.push(message);

    // Max batch size → flush immediately
    if (buffer.length >= MAX_BATCH_SIZE) {
      this.clearBatchTimer(bufferKey);
      await this.flushBatch(bufferKey);
      return;
    }

    // Reset debounce timer
    this.clearBatchTimer(bufferKey);
    const timer = setTimeout(() => {
      this.flushBatch(bufferKey).catch((err) => {
        this.logger('error', `Batch flush error for ${bufferKey}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, BATCH_WAIT_MS);
    this.batchTimers.set(bufferKey, timer);
  }

  /** Flush a single chat's batch buffer */
  private async flushBatch(bufferKey: string): Promise<void> {
    // Atomic swap: move buffer to local, clear map entry
    const messages = this.messageBuffers.get(bufferKey);
    this.messageBuffers.delete(bufferKey);
    this.clearBatchTimer(bufferKey);

    if (!messages?.length || !this.messageHandler) return;

    const combined = combineMessages(messages);

    try {
      await this.messageHandler(combined);
    } catch (err) {
      this.logger('error', `Error handling batched message on ${this.name}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Flush all remaining buffers (called on stop) */
  protected async flushAllBuffers(): Promise<void> {
    const keys = [...this.messageBuffers.keys()];
    for (const key of keys) {
      this.clearBatchTimer(key);
      await this.flushBatch(key);
    }
  }

  private clearBatchTimer(bufferKey: string): void {
    const timer = this.batchTimers.get(bufferKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(bufferKey);
    }
  }

  getStatus(): InterfaceStatus {
    return this.status;
  }

  getInfo(): InterfaceInfo {
    return {
      name: this.name,
      channel: this.channel,
      status: this.status,
      connectedAt: this.connectedAt,
      lastActivity: this.lastActivity,
    };
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendResponse(response: ExternalResponse): Promise<void>;
}
