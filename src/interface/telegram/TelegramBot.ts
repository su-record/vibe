/**
 * TelegramBot - Telegram interface for Vibe
 * Phase 4: External Interface
 *
 * Polling mode, no webhook server needed.
 * Uses native HTTPS for Telegram Bot API.
 */

import * as https from 'node:https';
import * as crypto from 'node:crypto';
import { BaseInterface } from '../BaseInterface.js';
import {
  ChannelType,
  ExternalMessage,
  ExternalResponse,
  InterfaceLogger,
  TelegramConfig,
} from '../types.js';
import { TelegramFormatter } from './TelegramFormatter.js';

const TELEGRAM_API = 'https://api.telegram.org';

export class TelegramBot extends BaseInterface {
  readonly name = 'telegram';
  readonly channel: ChannelType = 'telegram';

  private config: TelegramConfig;
  private pollingOffset: number = 0;
  private pollingActive: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private formatter: TelegramFormatter;

  constructor(config: TelegramConfig, logger: InterfaceLogger) {
    super(logger);
    this.config = config;
    this.formatter = new TelegramFormatter();
  }

  async start(): Promise<void> {
    this.status = 'connecting';
    this.logger('info', 'Starting Telegram bot...');

    try {
      const me = await this.apiCall('getMe') as Record<string, unknown>;
      this.logger('info', `Telegram bot connected: @${String(me.username)}`);
      this.status = 'enabled';
      this.connectedAt = new Date().toISOString();
      this.retryCount = 0;
      this.startPolling();
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.pollingActive = false;
    this.status = 'disabled';
    this.logger('info', 'Telegram bot stopped');
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    const chunks = this.formatter.splitMessage(response.content);

    for (const chunk of chunks) {
      await this.apiCall('sendMessage', {
        chat_id: response.chatId,
        text: chunk,
        parse_mode: 'Markdown',
      });
    }
  }

  /** Check if a chat ID is authorized */
  isAuthorized(chatId: string): boolean {
    return this.config.allowedChatIds.includes(chatId);
  }

  // ========================================================================
  // Private
  // ========================================================================

  private startPolling(): void {
    this.pollingActive = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.pollingActive) return;

    try {
      const updates = await this.apiCall('getUpdates', {
        offset: this.pollingOffset,
        timeout: this.config.pollingTimeout || 30,
      });

      this.retryCount = 0;

      if (Array.isArray(updates)) {
        for (const update of updates) {
          this.pollingOffset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      }
    } catch (err) {
      this.retryCount++;
      this.logger('warn', `Telegram polling error (attempt ${this.retryCount}/${this.maxRetries})`, {
        error: err instanceof Error ? err.message : String(err),
      });

      if (this.retryCount >= this.maxRetries) {
        this.pollingActive = false;
        this.status = 'error';
        this.logger('error', 'Telegram polling stopped after max retries');
        return;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, this.retryCount - 1) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }

    if (this.pollingActive) {
      // Schedule next poll
      setTimeout(() => this.poll(), 100);
    }
  }

  private async handleUpdate(update: Record<string, unknown>): Promise<void> {
    const message = update.message as Record<string, unknown> | undefined;
    if (!message) return;

    const chat = message.chat as Record<string, unknown>;
    const chatId = String(chat.id);

    // Security: reject unauthorized chats
    if (!this.isAuthorized(chatId)) {
      this.logger('warn', `Rejected message from unauthorized chat: ${chatId}`);
      return;
    }

    const from = message.from as Record<string, unknown> | undefined;
    const userId = from ? String(from.id) : 'unknown';
    const messageId = String(message.message_id);

    let content = '';
    let type: ExternalMessage['type'] = 'text';

    if (message.text) {
      content = String(message.text);
      type = 'text';
    } else if (message.voice || message.audio) {
      type = 'voice';
      content = '[voice message]';
    } else if (message.document) {
      type = 'file';
      const doc = message.document as Record<string, unknown>;
      content = String(doc.file_name || 'unknown');
    }

    const externalMessage: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'telegram',
      chatId,
      userId,
      content,
      type,
      metadata: { telegramMessageId: messageId },
      timestamp: new Date().toISOString(),
    };

    await this.dispatchMessage(externalMessage);
  }

  private apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${TELEGRAM_API}/bot${this.config.botToken}/${method}`);

      const postData = params ? JSON.stringify(params) : '';
      const options = {
        method: params ? 'POST' : 'GET',
        headers: params
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
          : {},
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              resolve(parsed.result);
            } else {
              reject(new Error(`Telegram API error: ${parsed.description}`));
            }
          } catch {
            reject(new Error('Invalid JSON from Telegram API'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy(new Error('Telegram API timeout'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }
}
