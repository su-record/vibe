/**
 * Gemini Live Stream — Phase 4-2
 *
 * Extends GeminiLive WebSocket for video frame + audio interleaving.
 * Auto-reconnect with exponential backoff (2s → 4s → 8s).
 */

import type { VisionLogger } from './types.js';
import { createVisionError } from './types.js';

const GEMINI_LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const DEFAULT_MODEL = 'gemini-2.0-flash-exp';
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [2000, 4000, 8000];
const MAX_FRAME_SIZE_BYTES = 200 * 1024; // 200KB per frame

// ============================================================================
// WebSocket shape (dynamic import 'ws')
// ============================================================================

interface WSLike {
  send(data: string): void;
  close(): void;
  ping(): void;
  on(event: 'open', handler: () => void): void;
  on(event: 'message', handler: (data: Buffer | string) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  readyState: number;
}

// ============================================================================
// Server response shape
// ============================================================================

interface ServerContent {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{ text?: string }>;
    };
    turnComplete?: boolean;
  };
}

// ============================================================================
// Event types
// ============================================================================

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'turn_complete'; fullText: string }
  | { type: 'error'; error: string }
  | { type: 'disconnected' }
  | { type: 'reconnecting'; attempt: number };

type StreamListener = (event: StreamEvent) => void;

// ============================================================================
// GeminiLiveStream
// ============================================================================

export class GeminiLiveStream {
  private apiKey: string;
  private logger: VisionLogger;
  private ws: WSLike | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private model: string;
  private systemInstruction: string | undefined;
  private listeners: StreamListener[] = [];
  private accumulated = '';

  constructor(apiKey: string, logger: VisionLogger) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.model = DEFAULT_MODEL;
  }

  async connect(model?: string, systemInstruction?: string): Promise<void> {
    if (this.ws && this.ws.readyState === 1) {
      this.logger('warn', 'GeminiLiveStream already connected');
      return;
    }

    this.model = model ?? DEFAULT_MODEL;
    this.systemInstruction = systemInstruction;
    const url = `${GEMINI_LIVE_URL}?key=${this.apiKey}`;

    const wsModule = await this.loadWS();
    this.ws = new wsModule(url);
    await this.awaitConnection();
  }

  async disconnect(): Promise<void> {
    this.clearHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.accumulated = '';
    this.logger('info', 'GeminiLiveStream disconnected');
  }

  /** Send a video frame as base64 with optional prompt */
  sendFrame(frameBase64: string, mimeType: string, prompt?: string): void {
    if (!this.ws || this.ws.readyState !== 1) {
      this.emit({ type: 'error', error: 'WebSocket not connected' });
      return;
    }

    const estimatedBytes = (frameBase64.length * 3) / 4;
    if (estimatedBytes > MAX_FRAME_SIZE_BYTES) {
      this.logger('warn', `Frame too large: ${(estimatedBytes / 1024).toFixed(0)}KB > 200KB`);
    }

    const parts: Array<Record<string, unknown>> = [
      { inlineData: { mimeType, data: frameBase64 } },
    ];
    if (prompt) {
      parts.push({ text: prompt });
    }

    const message = {
      clientContent: {
        turns: [{ role: 'user', parts }],
        turnComplete: true,
      },
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      this.emit({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Register event listener */
  on(listener: StreamListener): void {
    this.listeners.push(listener);
  }

  /** Remove event listener */
  off(listener: StreamListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // ============================================================================
  // Private
  // ============================================================================

  private async loadWS(): Promise<new (url: string) => WSLike> {
    try {
      const mod = 'ws';
      const imported = (await import(mod)) as { default: new (url: string) => WSLike };
      return imported.default;
    } catch {
      throw createVisionError('GEMINI_CONNECTION_FAILED', 'ws 패키지가 설치되지 않았습니다.');
    }
  }

  private awaitConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        this.setupHeartbeat();
        this.sendSetup();
        this.reconnectAttempts = 0;
        this.logger('info', 'GeminiLiveStream connected');
        resolve();
      };

      const onError = (err: Error): void => {
        this.logger('error', `GeminiLiveStream error: ${err.message}`);
        reject(err);
      };

      const onClose = (): void => {
        this.handleDisconnect();
      };

      const onMessage = (data: Buffer | string): void => {
        this.handleMessage(data);
      };

      this.ws!.on('open', onOpen);
      this.ws!.on('error', onError);
      this.ws!.on('close', onClose);
      this.ws!.on('message', onMessage);
    });
  }

  private sendSetup(): void {
    const setup: Record<string, unknown> = {
      setup: {
        model: this.model,
        generationConfig: { responseModalities: ['TEXT'] },
        ...(this.systemInstruction
          ? { systemInstruction: { parts: [{ text: this.systemInstruction }] } }
          : {}),
      },
    };
    this.ws!.send(JSON.stringify(setup));
  }

  private setupHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        try { this.ws.ping(); } catch { /* ignore */ }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleMessage(data: Buffer | string): void {
    try {
      const msg = JSON.parse(data.toString()) as ServerContent;

      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.text) {
            this.accumulated += part.text;
            this.emit({ type: 'text', text: part.text });
          }
        }
      }

      if (msg.serverContent?.turnComplete) {
        this.emit({ type: 'turn_complete', fullText: this.accumulated });
        this.accumulated = '';
      }
    } catch (err) {
      this.logger('error', `Message parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private handleDisconnect(): void {
    this.clearHeartbeat();
    this.emit({ type: 'disconnected' });

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts];
      this.reconnectAttempts++;
      this.emit({ type: 'reconnecting', attempt: this.reconnectAttempts });
      this.logger('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect(this.model, this.systemInstruction).catch((err) => {
          this.emit({ type: 'error', error: err instanceof Error ? err.message : String(err) });
        });
      }, delay);
    } else {
      this.emit({ type: 'error', error: '최대 재연결 횟수(3회) 초과' });
      this.logger('error', 'Max reconnect attempts reached');
    }
  }

  private emit(event: StreamEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* ignore listener errors */ }
    }
  }
}
