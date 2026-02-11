/**
 * SlackBot - Slack interface for Vibe
 * Phase 3: Slack Channel
 *
 * Socket Mode with native WebSocket client implementation.
 * Uses native HTTPS for Slack Web API.
 */

import * as http from 'node:http';
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
  InterfaceLogger,
  SlackConfig,
} from '../types.js';
import { SlackFormatter } from './SlackFormatter.js';

const SLACK_API = 'https://slack.com/api';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_EVENT_DEDUP_SIZE = 10_000;

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface EventDedup {
  eventId: string;
  timestamp: number;
}

/** Slack Block Kit block (section, actions, etc.) */
interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{
    type: string;
    text?: { type: string; text: string };
    action_id?: string;
    style?: string;
    url?: string;
  }>;
  block_id?: string;
}

type BlockActionHandler = (channelId: string, actionId: string, userId: string) => Promise<void>;

export class SlackBot extends BaseInterface {
  readonly name = 'slack';
  readonly channel: ChannelType = 'slack';

  private config: SlackConfig;
  private ws: import('node:net').Socket | null = null;
  private wsUrl: string | null = null;
  private reconnectAttempt: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private formatter: SlackFormatter;
  private tokenBucket: TokenBucket;
  private eventDedup: Map<string, EventDedup>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private blockActionHandler?: BlockActionHandler;

  constructor(config: SlackConfig, logger: InterfaceLogger) {
    super(logger);
    this.config = config;
    this.formatter = new SlackFormatter();
    this.tokenBucket = { tokens: 5, lastRefill: Date.now() };
    this.eventDedup = new Map();
  }

  async start(): Promise<void> {
    this.status = 'connecting';
    this.logger('info', 'Starting Slack bot (Socket Mode)...');

    try {
      // Test bot token validity first
      const authTest = await this.apiCall('auth.test') as Record<string, unknown>;
      this.logger('info', `Slack bot authenticated: ${String(authTest.user)}`);

      // Get WebSocket URL from Socket Mode
      await this.connectSocketMode();

      this.status = 'enabled';
      this.connectedAt = new Date().toISOString();
      this.reconnectAttempt = 0;

      // Start cleanup timer for event deduplication
      this.startCleanupTimer();
    } catch (err) {
      this.status = 'error';
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.ws) {
      this.ws.destroy();
      this.ws = null;
    }

    await this.flushAllBuffers();
    this.status = 'disabled';
    this.logger('info', 'Slack bot stopped');
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    // Phase 7: Skip mrkdwn conversion for plain text format
    const content = response.format === 'text'
      ? response.content
      : this.formatter.toSlackMrkdwn(response.content);
    const chunks = this.formatter.splitMessage(content);

    for (const chunk of chunks) {
      await this.rateLimitedCall(async () => {
        await this.apiCall('chat.postMessage', {
          channel: response.chatId,
          text: chunk,
          ...(response.metadata?.thread_ts ? { thread_ts: String(response.metadata.thread_ts) } : {}),
        });
      });
    }
  }

  /**
   * Block Kit 메시지 전송 (버튼 포함)
   * Slack Block Kit actions 블록으로 인터랙티브 버튼 지원
   */
  async sendBlockMessage(
    channelId: string,
    text: string,
    blocks: SlackBlock[],
  ): Promise<void> {
    await this.rateLimitedCall(async () => {
      await this.apiCall('chat.postMessage', {
        channel: channelId,
        text,
        blocks,
      });
    });
  }

  /** Block action 이벤트 핸들러 등록 */
  onBlockAction(handler: BlockActionHandler): void {
    this.blockActionHandler = handler;
  }

  /** Check if a channel ID is authorized */
  isAuthorized(channelId: string): boolean {
    return this.config.allowedChannelIds.includes(channelId);
  }

  // ========================================================================
  // Private - Socket Mode
  // ========================================================================

  private async connectSocketMode(): Promise<void> {
    // Get WebSocket URL
    const result = await this.apiCallWithAppToken('apps.connections.open') as Record<string, unknown>;
    this.wsUrl = String(result.url);

    this.logger('info', `Connecting to Socket Mode: ${this.wsUrl}`);

    await this.connectWebSocket(this.wsUrl);
  }

  private connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = new URL(url);
      const isSecure = wsUrl.protocol === 'wss:';
      const port = wsUrl.port || (isSecure ? 443 : 80);

      // Generate WebSocket key
      const wsKey = crypto.randomBytes(16).toString('base64');

      const options = {
        hostname: wsUrl.hostname,
        port,
        path: wsUrl.pathname + wsUrl.search,
        method: 'GET',
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Key': wsKey,
          'Sec-WebSocket-Version': '13',
        },
      };

      const httpModule = isSecure ? https : http;
      const req = httpModule.request(options);

      req.on('upgrade', (res: unknown, socket: import('node:net').Socket, head: Buffer) => {
        this.ws = socket;
        this.logger('info', 'WebSocket connected to Slack Socket Mode');

        let buffer = head;

        socket.on('data', (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk]);
          buffer = this.processWebSocketFrames(buffer);
        });

        socket.on('close', () => {
          this.logger('warn', 'WebSocket connection closed');
          this.handleReconnect();
        });

        socket.on('error', (err: Error) => {
          this.logger('error', 'WebSocket error', { error: err.message });
          this.handleReconnect();
        });

        resolve();
      });

      req.on('error', (err: Error) => {
        this.logger('error', 'WebSocket connection failed', { error: err.message });
        reject(err);
      });

      req.end();
    });
  }

  private processWebSocketFrames(buffer: Buffer): Buffer {
    while (buffer.length >= 2) {
      const firstByte = buffer[0];
      const secondByte = buffer[1];

      const fin = (firstByte & 0x80) !== 0;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;

      let offset = 2;

      if (payloadLength === 126) {
        if (buffer.length < 4) return buffer;
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (buffer.length < 10) return buffer;
        const high = buffer.readUInt32BE(2);
        const low = buffer.readUInt32BE(6);
        payloadLength = high * 0x100000000 + low;
        offset = 10;
      }

      if (masked) {
        offset += 4; // mask key
      }

      if (buffer.length < offset + payloadLength) {
        return buffer; // incomplete frame
      }

      const payload = buffer.slice(offset, offset + payloadLength);
      buffer = buffer.slice(offset + payloadLength);

      if (!fin) {
        // Fragmented frames not implemented for simplicity
        continue;
      }

      if (opcode === 0x1) {
        // Text frame
        const text = payload.toString('utf8');
        this.handleSocketMessage(text).catch((err) => {
          this.logger('error', 'Error handling Socket Mode message', { error: err instanceof Error ? err.message : String(err) });
        });
      } else if (opcode === 0x9) {
        // Ping
        this.sendWebSocketFrame(0xa, payload); // Pong
      } else if (opcode === 0x8) {
        // Close
        this.ws?.end();
      }
    }

    return buffer;
  }

  private sendWebSocketFrame(opcode: number, payload: Buffer | string): void {
    if (!this.ws) return;

    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const payloadLength = payloadBuffer.length;

    let frame: Buffer;
    let offset = 2;

    if (payloadLength < 126) {
      frame = Buffer.allocUnsafe(2 + 4 + payloadLength); // +4 for mask
      frame[1] = 0x80 | payloadLength; // masked
    } else if (payloadLength < 65536) {
      frame = Buffer.allocUnsafe(4 + 4 + payloadLength);
      frame[1] = 0x80 | 126;
      frame.writeUInt16BE(payloadLength, 2);
      offset = 4;
    } else {
      frame = Buffer.allocUnsafe(10 + 4 + payloadLength);
      frame[1] = 0x80 | 127;
      frame.writeUInt32BE(0, 2); // high 32 bits
      frame.writeUInt32BE(payloadLength, 6); // low 32 bits
      offset = 10;
    }

    frame[0] = 0x80 | opcode; // FIN + opcode

    // Generate mask key (client MUST mask)
    const maskKey = crypto.randomBytes(4);
    maskKey.copy(frame, offset);
    offset += 4;

    // Mask payload
    for (let i = 0; i < payloadLength; i++) {
      frame[offset + i] = payloadBuffer[i] ^ maskKey[i % 4];
    }

    this.ws.write(frame);
  }

  private async handleSocketMessage(message: string): Promise<void> {
    try {
      const envelope = JSON.parse(message) as Record<string, unknown>;
      const envelopeId = String(envelope.envelope_id || '');

      // ACK immediately (within 3 seconds)
      if (envelopeId) {
        this.sendWebSocketFrame(0x1, JSON.stringify({ envelope_id: envelopeId }));
      }

      const type = String(envelope.type || '');

      if (type === 'events_api') {
        const payload = envelope.payload as Record<string, unknown>;
        const event = payload.event as Record<string, unknown>;
        await this.handleEvent(event);
      } else if (type === 'interactive') {
        const payload = envelope.payload as Record<string, unknown>;
        await this.handleInteractive(payload);
      } else if (type === 'disconnect') {
        this.logger('warn', 'Slack requested disconnect');
        this.handleReconnect();
      }
    } catch (err) {
      this.logger('error', 'Failed to parse Socket Mode message', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async handleEvent(event: Record<string, unknown>): Promise<void> {
    const eventType = String(event.type || '');
    const eventId = String(event.event_id || event.client_msg_id || crypto.randomUUID());

    // Deduplication
    if (this.eventDedup.has(eventId)) {
      return;
    }
    if (this.eventDedup.size >= MAX_EVENT_DEDUP_SIZE) {
      const oldestKey = this.eventDedup.keys().next().value;
      if (oldestKey !== undefined) this.eventDedup.delete(oldestKey);
    }
    this.eventDedup.set(eventId, { eventId, timestamp: Date.now() });

    // Ignore bot's own messages
    if (event.bot_id) {
      return;
    }

    if (eventType === 'message' || eventType === 'app_mention') {
      await this.handleMessageEvent(event);
    }
  }

  private async handleInteractive(payload: Record<string, unknown>): Promise<void> {
    const interactionType = String(payload.type || '');
    if (interactionType !== 'block_actions') return;

    const actions = payload.actions as Array<Record<string, unknown>> | undefined;
    if (!actions?.length) return;

    const channelObj = payload.channel as Record<string, unknown> | undefined;
    const channelId = String(channelObj?.id || '');
    const userObj = payload.user as Record<string, unknown> | undefined;
    const userId = String(userObj?.id || '');

    for (const action of actions) {
      const actionId = String(action.action_id || '');
      if (actionId && this.blockActionHandler) {
        try {
          await this.blockActionHandler(channelId, actionId, userId);
        } catch (err) {
          this.logger('error', `Block action handler error: ${actionId}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  private async handleMessageEvent(event: Record<string, unknown>): Promise<void> {
    const channel = String(event.channel || '');
    const user = String(event.user || '');
    const text = String(event.text || '');
    const threadTs = event.thread_ts ? String(event.thread_ts) : undefined;
    const ts = String(event.ts || '');

    // Filter by allowed channels
    if (!this.isAuthorized(channel)) {
      this.logger('warn', `Rejected message from unauthorized channel: ${channel}`);
      return;
    }

    const metadata: Record<string, unknown> = {
      slackTs: ts,
    };

    if (threadTs) {
      metadata.thread_ts = threadTs;
    }

    // Handle file uploads — download locally + create FileAttachment[]
    const fileAttachments: FileAttachment[] = [];
    if (Array.isArray(event.files) && event.files.length > 0) {
      const files = event.files as Array<Record<string, unknown>>;
      const msgDir = this.getFileStoragePath(channel, ts);

      for (const file of files) {
        const fileId = String(file.id || '');
        try {
          const fileInfo = await this.apiCall('files.info', { file: fileId }) as Record<string, unknown>;
          const fileObj = fileInfo.file as Record<string, unknown>;
          const urlPrivate = String(fileObj.url_private || '');
          const origName = String(fileObj.name || 'unknown');
          const fileName = this.sanitizeFileName(origName);
          const mimeType = String(fileObj.mimetype || 'application/octet-stream');
          const size = typeof fileObj.size === 'number' ? fileObj.size : 0;

          if (size > MAX_FILE_SIZE) {
            this.logger('warn', `File ${fileName} exceeds max size (10MB), skipping`);
            continue;
          }

          const saved = await this.downloadSlackFile(urlPrivate, msgDir, fileName);
          if (saved) {
            const fileType = this.detectFileType(mimeType);
            fileAttachments.push({ type: fileType, path: saved, name: fileName, mimeType, size });
          }
        } catch (err) {
          this.logger('warn', `Failed to get file info for ${fileId}`, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      metadata.files = fileAttachments.map(f => ({ name: f.name, mimeType: f.mimeType, size: f.size }));
    }

    const externalMessage: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'slack',
      chatId: channel,
      userId: user,
      content: text,
      type: fileAttachments.length > 0 ? 'file' : 'text',
      metadata,
      timestamp: new Date().toISOString(),
      ...(fileAttachments.length > 0 ? { files: fileAttachments } : {}),
    };

    await this.dispatchMessage(externalMessage);
  }

  private handleReconnect(): void {
    if (this.reconnectTimer) {
      return; // already scheduled
    }

    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.logger('error', 'Max reconnect attempts reached, stopping');
      this.status = 'error';
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempt) * 1000; // 1s, 2s, 4s, 8s, 16s
    this.reconnectAttempt++;

    this.logger('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        if (this.wsUrl) {
          await this.connectWebSocket(this.wsUrl);
          this.reconnectAttempt = 0;
        } else {
          await this.connectSocketMode();
        }
      } catch (err) {
        this.logger('error', 'Reconnect failed', { error: err instanceof Error ? err.message : String(err) });
        this.handleReconnect();
      }
    }, delay);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const expiry = 60 * 1000; // 60 seconds

      const toDelete: string[] = [];
      this.eventDedup.forEach((entry, eventId) => {
        if (now - entry.timestamp > expiry) {
          toDelete.push(eventId);
        }
      });

      toDelete.forEach(eventId => this.eventDedup.delete(eventId));
    }, 30000); // cleanup every 30s
  }

  // ========================================================================
  // Private - API Calls
  // ========================================================================

  private apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.apiCallInternal(method, this.config.botToken, params);
  }

  private apiCallWithAppToken(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.apiCallInternal(method, this.config.appToken, params);
  }

  private apiCallInternal(method: string, token: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${SLACK_API}/${method}`);

      const postData = params ? JSON.stringify(params) : '';
      const options = {
        method: params ? 'POST' : 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(params ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          } : {}),
        },
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            if (parsed.ok) {
              resolve(parsed);
            } else {
              reject(new Error(`Slack API error: ${String(parsed.error)}`));
            }
          } catch {
            reject(new Error('Invalid JSON from Slack API'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy(new Error('Slack API timeout'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  // ========================================================================
  // Private - Rate Limiting
  // ========================================================================

  private async rateLimitedCall(fn: () => Promise<void>): Promise<void> {
    const now = Date.now();
    const refillRate = 30 / 60000; // 30 per minute
    const elapsed = now - this.tokenBucket.lastRefill;
    const tokensToAdd = elapsed * refillRate;

    this.tokenBucket.tokens = Math.min(5, this.tokenBucket.tokens + tokensToAdd);
    this.tokenBucket.lastRefill = now;

    if (this.tokenBucket.tokens < 1) {
      const waitTime = (1 - this.tokenBucket.tokens) / refillRate;
      await new Promise((r) => setTimeout(r, waitTime));
      this.tokenBucket.tokens = 1;
    }

    this.tokenBucket.tokens -= 1;
    await fn();
  }

  // ========================================================================
  // Private - File Download
  // ========================================================================

  /** Sanitize filename to prevent path traversal */
  private sanitizeFileName(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, '_').replace(/\.\./g, '_');
  }

  /** Get local file storage path for a Slack message */
  private getFileStoragePath(channelId: string, ts: string): string {
    const safeTs = ts.replace(/\./g, '_');
    return path.join(
      os.homedir(), '.vibe', 'files', 'slack', channelId, `msg_${safeTs}`,
    );
  }

  /** Detect FileAttachment type from MIME type */
  private detectFileType(mimeType: string): FileAttachment['type'] {
    if (mimeType.startsWith('image/')) return 'photo';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /** Download a file from Slack url_private with auth header */
  private async downloadSlackFile(
    url: string,
    dir: string,
    fileName: string,
  ): Promise<string | null> {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const buffer = await this.httpGetWithAuth(url);
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (err) {
      this.logger('warn', `Failed to download Slack file: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /** HTTP GET with Bearer token auth (for Slack file downloads) */
  private httpGetWithAuth(fileUrl: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const url = new URL(fileUrl);
      const options = {
        headers: { 'Authorization': `Bearer ${this.config.botToken}` },
      };
      https.get(url, options, (res) => {
        // Follow redirects (Slack sometimes redirects file URLs)
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            this.httpGetWithAuth(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}
