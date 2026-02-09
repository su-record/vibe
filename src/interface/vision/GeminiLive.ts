/**
 * GeminiLive - WebSocket client for Gemini Live API
 * Phase 3: External Interface (Vision)
 *
 * Features:
 * - Bidirectional streaming with Gemini 2.0 Flash
 * - Auto-reconnect with exponential backoff
 * - Heartbeat monitoring (30s PING interval)
 * - Size limits (5MB image, 10MB message)
 */

import type { InterfaceLogger } from '../types.js';
import type { LogLevel } from '../../daemon/types.js';

const GEMINI_LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
const DEFAULT_MODEL = 'gemini-2.0-flash-exp';
const HEARTBEAT_INTERVAL_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_MESSAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const RESPONSE_TIMEOUT_MS = 60000;

export interface GeminiContent {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

interface SetupMessage {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
    };
    systemInstruction?: {
      parts: Array<{ text: string }>;
    };
  };
}

interface ContentMessage {
  clientContent: {
    turns: Array<{
      role: string;
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }>;
    turnComplete: boolean;
  };
}

interface ServerContent {
  serverContent?: {
    modelTurn?: {
      parts?: Array<{ text?: string }>;
    };
    turnComplete?: boolean;
  };
}

type WebSocketLike = {
  send(data: string): void;
  close(): void;
  ping(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  readyState: number;
};

export class GeminiLive {
  private apiKey: string;
  private logger: InterfaceLogger;
  private ws: WebSocketLike | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private pendingResponse: {
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
    accumulated: string;
    timeout: NodeJS.Timeout;
  } | null = null;

  constructor(apiKey: string, logger?: InterfaceLogger) {
    this.apiKey = apiKey;
    this.logger = logger || this.defaultLogger;
  }

  private defaultLogger: InterfaceLogger = (level: LogLevel, msg: string, data?: unknown) => {
    const prefix = `[GeminiLive]`;
    if (data !== undefined) {
      console[level](`${prefix} ${msg}`, data);
    } else {
      console[level](`${prefix} ${msg}`);
    }
  };

  async connect(model?: string, systemInstruction?: string): Promise<void> {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      this.logger('warn', 'Already connected');
      return;
    }

    const targetModel = model || DEFAULT_MODEL;
    const url = `${GEMINI_LIVE_URL}?key=${this.apiKey}`;

    try {
      // Dynamic import to gracefully handle missing 'ws' package
      // Using string literal to prevent TypeScript compile-time resolution
      const moduleName = 'ws';
      let wsModule: { default: new (url: string) => WebSocketLike };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wsModule = (await import(moduleName)) as any;
      } catch {
        throw new Error('WebSocket library (ws) not installed. Run: npm install ws');
      }

      this.ws = new wsModule.default(url);

      await new Promise<void>((resolve, reject) => {
        const onOpen = (..._args: unknown[]) => {
          this.logger('info', 'WebSocket connected');
          this.setupHeartbeat();
          this.sendSetupMessage(targetModel, systemInstruction);
          this.reconnectAttempts = 0;
          resolve();
        };

        const onError = (...args: unknown[]) => {
          const err = args[0];
          this.logger('error', 'WebSocket error', err);
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        const onClose = (..._args: unknown[]) => {
          this.logger('warn', 'WebSocket closed');
          this.handleDisconnect();
        };

        const onMessage = (...args: unknown[]) => {
          const data = args[0];
          if (data instanceof Buffer || typeof data === 'string') {
            this.handleMessage(data);
          }
        };

        this.ws!.on('open', onOpen);
        this.ws!.on('error', onError);
        this.ws!.on('close', onClose);
        this.ws!.on('message', onMessage);

        // Cleanup listeners after connection attempt
        setTimeout(() => {
          if (this.ws) {
            this.ws.off('open', onOpen);
            this.ws.off('error', onError);
          }
        }, 5000);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger('error', `Connection failed: ${msg}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.pendingResponse) {
      clearTimeout(this.pendingResponse.timeout);
      this.pendingResponse.reject(new Error('Disconnected'));
      this.pendingResponse = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.logger('info', 'Disconnected');
  }

  async sendText(text: string): Promise<string> {
    return this.sendContent({ text });
  }

  async sendImage(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
    // Validate image size BEFORE connection check (base64 is ~33% larger than binary)
    const estimatedBytes = (imageBase64.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image too large: ${(estimatedBytes / 1024 / 1024).toFixed(2)}MB (max 5MB)`);
    }

    return this.sendContent({ text: prompt, imageBase64, imageMimeType: mimeType });
  }

  async sendContent(content: GeminiContent): Promise<string> {
    // Validate message size BEFORE connection check
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (content.text) {
      parts.push({ text: content.text });
    }

    if (content.imageBase64 && content.imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: content.imageMimeType,
          data: content.imageBase64,
        },
      });
    }

    const message: ContentMessage = {
      clientContent: {
        turns: [{ role: 'user', parts }],
        turnComplete: true,
      },
    };

    const messageStr = JSON.stringify(message);
    if (Buffer.byteLength(messageStr) > MAX_MESSAGE_SIZE_BYTES) {
      throw new Error(
        `Message too large: ${(Buffer.byteLength(messageStr) / 1024 / 1024).toFixed(2)}MB (max 10MB)`
      );
    }

    // Connection check after validation
    if (!this.ws || this.ws.readyState !== 1 /* OPEN */) {
      throw new Error('Not connected. Call connect() first.');
    }

    if (this.pendingResponse) {
      throw new Error('Previous request still pending');
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingResponse) {
          this.pendingResponse = null;
          reject(new Error('Response timeout'));
        }
      }, RESPONSE_TIMEOUT_MS);

      this.pendingResponse = {
        resolve,
        reject,
        accumulated: '',
        timeout,
      };

      try {
        this.ws!.send(messageStr);
        this.logger('debug', 'Sent content', { partsCount: parts.length });
      } catch (err) {
        clearTimeout(timeout);
        this.pendingResponse = null;
        reject(err);
      }
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1 /* OPEN */;
  }

  private sendSetupMessage(model: string, systemInstruction?: string): void {
    const setup: SetupMessage = {
      setup: {
        model,
        generationConfig: {
          responseModalities: ['TEXT'],
        },
      },
    };

    if (systemInstruction) {
      setup.setup.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    try {
      this.ws!.send(JSON.stringify(setup));
      this.logger('debug', 'Sent setup message', { model });
    } catch (err) {
      this.logger('error', 'Failed to send setup message', err);
    }
  }

  private setupHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1 /* OPEN */) {
        try {
          this.ws.ping();
          this.logger('debug', 'Sent heartbeat');
        } catch (err) {
          this.logger('warn', 'Heartbeat failed', err);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handleMessage(data: Buffer | string): void {
    try {
      const message = JSON.parse(data.toString()) as ServerContent;

      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.text && this.pendingResponse) {
            this.pendingResponse.accumulated += part.text;
          }
        }
      }

      if (message.serverContent?.turnComplete && this.pendingResponse) {
        const result = this.pendingResponse.accumulated;
        clearTimeout(this.pendingResponse.timeout);
        this.pendingResponse.resolve(result);
        this.pendingResponse = null;
        this.logger('debug', 'Turn complete', { length: result.length });
      }
    } catch (err) {
      this.logger('error', 'Failed to parse message', err);
    }
  }

  private handleDisconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.pendingResponse) {
      clearTimeout(this.pendingResponse.timeout);
      this.pendingResponse.reject(new Error('Connection lost'));
      this.pendingResponse = null;
    }

    // Auto-reconnect logic
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_DELAYS_MS[this.reconnectAttempts];
      this.reconnectAttempts += 1;

      this.logger('info', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect().catch((err) => {
          this.logger('error', 'Reconnect failed', err);
        });
      }, delay);
    } else {
      this.logger('error', 'Max reconnect attempts reached');
    }
  }
}
