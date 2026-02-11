/**
 * TelegramBot - Telegram interface for Vibe
 * Phase 4: External Interface
 *
 * Polling mode, no webhook server needed.
 * Uses native HTTPS for Telegram Bot API.
 */

import * as https from 'node:https';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { BaseInterface } from '../BaseInterface.js';
import {
  ChannelType,
  ExternalMessage,
  ExternalResponse,
  FileAttachment,
  LocationInfo,
  InterfaceLogger,
  TelegramConfig,
} from '../types.js';
import { TelegramFormatter } from './TelegramFormatter.js';

const TELEGRAM_API = 'https://api.telegram.org';

export type CallbackQueryHandler = (
  chatId: string,
  data: string,
  callbackQueryId: string,
) => Promise<void>;

export class TelegramBot extends BaseInterface {
  readonly name = 'telegram';
  readonly channel: ChannelType = 'telegram';

  private config: TelegramConfig;
  private pollingOffset: number = 0;
  private pollingActive: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private formatter: TelegramFormatter;
  private callbackQueryHandler?: CallbackQueryHandler;

  constructor(config: TelegramConfig, logger: InterfaceLogger) {
    super(logger);
    this.config = config;
    this.formatter = new TelegramFormatter();
  }

  async start(): Promise<void> {
    this.status = 'connecting';
    this.logger('info', 'Starting Telegram bot...');

    try {
      // Remove any existing webhook so getUpdates polling works
      await this.apiCall('deleteWebhook', { drop_pending_updates: false });

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
    await this.flushAllBuffers();
    this.status = 'disabled';
    this.logger('info', 'Telegram bot stopped');
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    await this.sendResponseWithId(response);
  }

  /** Send response and return the first message_id (for progress tracking) */
  async sendResponseWithId(response: ExternalResponse): Promise<number | undefined> {
    const chunks = this.formatter.splitMessage(response.content);

    // Phase 7: parse_mode depends on format
    const parseModeMap: Record<string, string | undefined> = {
      text: undefined,
      markdown: 'Markdown',
      html: 'HTML',
    };
    const parseMode = parseModeMap[response.format ?? 'markdown'];

    let firstMessageId: number | undefined;
    for (const chunk of chunks) {
      const params: Record<string, unknown> = {
        chat_id: response.chatId,
        text: chunk,
      };
      if (parseMode) {
        params.parse_mode = parseMode;
      }
      const result = await this.apiCall('sendMessage', params) as Record<string, unknown>;
      if (firstMessageId === undefined && typeof result?.message_id === 'number') {
        firstMessageId = result.message_id;
      }
    }
    return firstMessageId;
  }

  /** Edit an existing message (for progress updates) */
  async editMessage(
    chatId: string,
    messageId: number,
    text: string,
    parseMode?: string,
  ): Promise<void> {
    try {
      const params: Record<string, unknown> = {
        chat_id: chatId,
        message_id: messageId,
        text,
      };
      if (parseMode) {
        params.parse_mode = parseMode;
      }
      await this.apiCall('editMessageText', params);
    } catch (err) {
      this.logger('warn', `Failed to edit message ${messageId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Send message with inline keyboard buttons */
  async sendInlineKeyboard(
    chatId: string,
    text: string,
    buttons: Array<Array<{ text: string; callback_data: string }>>,
  ): Promise<number | undefined> {
    const result = await this.apiCall('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: buttons },
    }) as Record<string, unknown>;
    return typeof result?.message_id === 'number' ? result.message_id : undefined;
  }

  /** Answer a callback query (removes loading spinner on inline button) */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.apiCall('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  /** Register handler for inline keyboard callback queries */
  onCallbackQuery(handler: CallbackQueryHandler): void {
    this.callbackQueryHandler = handler;
  }

  /** Get downloadable URL for a Telegram file */
  async getFileUrl(fileId: string): Promise<string> {
    const file = await this.apiCall('getFile', { file_id: fileId }) as Record<string, unknown>;
    const filePath = String(file.file_path);
    return `${TELEGRAM_API}/file/bot${this.config.botToken}/${filePath}`;
  }

  /** Download a Telegram file as Buffer */
  async downloadFile(fileId: string): Promise<Buffer> {
    const fileUrl = await this.getFileUrl(fileId);
    return this.httpGetBuffer(fileUrl);
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
      const pollingTimeout = this.config.pollingTimeout || 30;
      const updates = await this.apiCall(
        'getUpdates',
        { offset: this.pollingOffset, timeout: pollingTimeout },
        (pollingTimeout + 15) * 1000, // client timeout must exceed server long-poll timeout
      );

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
    // Handle callback queries (inline keyboard button presses)
    const callbackQuery = update.callback_query as Record<string, unknown> | undefined;
    if (callbackQuery) {
      await this.handleCallbackQuery(callbackQuery);
      return;
    }

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
    const metadata: Record<string, unknown> = { telegramMessageId: messageId };

    const files: FileAttachment[] = [];
    let location: LocationInfo | undefined;
    const msgDir = this.getFileStoragePath(chatId, messageId);

    if (message.text) {
      content = String(message.text);
      type = 'text';
    } else if (message.voice || message.audio) {
      type = 'voice';
      const voiceObj = (message.voice || message.audio) as Record<string, unknown>;
      const fileId = String(voiceObj.file_id || '');
      const mimeType = String(voiceObj.mime_type || 'audio/ogg');
      const isVoice = Boolean(message.voice);
      const ext = mimeType.includes('ogg') ? 'ogg' : 'mp3';
      const fileName = isVoice ? `voice_${messageId}.${ext}` : this.sanitizeFileName(String(voiceObj.file_name || `audio_${messageId}.${ext}`));

      content = '[voice message]';
      metadata.telegramFileId = fileId;
      metadata.voiceDuration = voiceObj.duration;
      metadata.voiceMimeType = mimeType;

      const saved = await this.downloadAndSaveFile(fileId, msgDir, fileName);
      if (saved) {
        files.push({ type: isVoice ? 'voice' : 'audio', path: saved, name: fileName, mimeType, size: voiceObj.file_size as number | undefined, duration: voiceObj.duration as number | undefined });
      }
    } else if (message.document) {
      type = 'file';
      const doc = message.document as Record<string, unknown>;
      const fileId = String(doc.file_id || '');
      const origName = String(doc.file_name || 'unknown');
      const fileName = this.sanitizeFileName(origName);
      const mimeType = String(doc.mime_type || '');

      content = origName;
      metadata.telegramFileId = fileId;
      metadata.fileMimeType = mimeType;
      metadata.fileSize = doc.file_size;

      const saved = await this.downloadAndSaveFile(fileId, msgDir, fileName);
      if (saved) {
        files.push({ type: 'document', path: saved, name: fileName, mimeType, size: doc.file_size as number | undefined });
      }
    } else if (message.photo) {
      type = 'file';
      const photos = message.photo as Array<Record<string, unknown>>;
      const largest = photos[photos.length - 1];
      const fileId = String(largest.file_id || '');
      const fileName = `image_${messageId}.jpg`;

      content = '[photo]';
      metadata.telegramFileId = fileId;
      metadata.fileMimeType = 'image/jpeg';

      const saved = await this.downloadAndSaveFile(fileId, msgDir, fileName);
      if (saved) {
        files.push({ type: 'photo', path: saved, name: fileName, mimeType: 'image/jpeg', size: largest.file_size as number | undefined });
      }
    } else if (message.video) {
      type = 'file';
      const video = message.video as Record<string, unknown>;
      const fileId = String(video.file_id || '');
      const mimeType = String(video.mime_type || 'video/mp4');
      const ext = mimeType.includes('mp4') ? 'mp4' : 'mkv';
      const fileName = `video_${messageId}.${ext}`;

      content = '[video]';
      metadata.telegramFileId = fileId;
      metadata.fileMimeType = mimeType;

      const saved = await this.downloadAndSaveFile(fileId, msgDir, fileName);
      if (saved) {
        files.push({ type: 'video', path: saved, name: fileName, mimeType, size: video.file_size as number | undefined, duration: video.duration as number | undefined });
      }
    }

    // Location handling
    if (message.location) {
      const loc = message.location as Record<string, unknown>;
      location = {
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        ...(loc.horizontal_accuracy ? { accuracy: Number(loc.horizontal_accuracy) } : {}),
      };
      if (!content) {
        content = `[위치: ${location.latitude}, ${location.longitude}]`;
        type = 'text';
      }
    }

    const externalMessage: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'telegram',
      chatId,
      userId,
      content,
      type,
      metadata,
      timestamp: new Date().toISOString(),
      ...(files.length > 0 ? { files } : {}),
      ...(location ? { location } : {}),
    };

    await this.dispatchMessage(externalMessage);
  }

  private async handleCallbackQuery(query: Record<string, unknown>): Promise<void> {
    const message = query.message as Record<string, unknown> | undefined;
    if (!message) return;

    const chat = message.chat as Record<string, unknown>;
    const chatId = String(chat.id);

    if (!this.isAuthorized(chatId)) return;

    const data = String(query.data || '');
    const callbackQueryId = String(query.id);

    if (this.callbackQueryHandler) {
      try {
        await this.callbackQueryHandler(chatId, data, callbackQueryId);
      } catch (err) {
        this.logger('warn', `Callback query handler error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Always answer to remove loading spinner
    try {
      await this.answerCallbackQuery(callbackQueryId);
    } catch { /* ignore */ }
  }

  private apiCall(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<unknown> {
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
      req.setTimeout(timeoutMs ?? 30_000, () => {
        req.destroy(new Error('Telegram API timeout'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  /** Download a file from URL as Buffer */
  private httpGetBuffer(fileUrl: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const url = new URL(fileUrl);
      https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /** Sanitize filename to prevent path traversal */
  private sanitizeFileName(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\.\./g, '_');
  }

  /** Get local file storage path for a message */
  private getFileStoragePath(chatId: string, messageId: string): string {
    return path.join(
      os.homedir(), '.vibe', 'files', 'telegram', chatId, `msg_${messageId}`,
    );
  }

  /** Download a Telegram file and save to local disk */
  private async downloadAndSaveFile(
    fileId: string,
    dir: string,
    fileName: string,
  ): Promise<string | null> {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const buffer = await this.downloadFile(fileId);
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (err) {
      this.logger('warn', `Failed to download file ${fileId}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
