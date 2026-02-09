/**
 * VisionInterface - Vision channel implementation
 * Phase 4: External Interface
 */

import { BaseInterface } from '../BaseInterface.js';
import { ChannelType, ExternalMessage, ExternalResponse, InterfaceLogger } from '../types.js';
import { GeminiVision } from './GeminiVision.js';
import { GeminiLive } from './GeminiLive.js';
import * as crypto from 'node:crypto';

export interface VisionConfig {
  enabled: boolean;
  geminiApiKey?: string;
  maxImageSizeMB?: number;
}

export class VisionInterface extends BaseInterface {
  readonly name = 'vision';
  readonly channel: ChannelType = 'vision';
  private vision: GeminiVision | null = null;
  private geminiLive: GeminiLive | null = null;
  private config: VisionConfig;

  constructor(config: VisionConfig, logger: InterfaceLogger) {
    super(logger);
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.status = 'disabled';
      return;
    }
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      this.logger('warn', 'Vision disabled: GEMINI_API_KEY not set');
      this.status = 'disabled';
      return;
    }
    this.vision = new GeminiVision(apiKey);

    // Try to create GeminiLive instance (lazy connect on first use)
    try {
      this.geminiLive = new GeminiLive(apiKey, this.logger);
      this.logger('info', 'GeminiLive client created (will connect on first use)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger('warn', `GeminiLive unavailable: ${msg}`);
      this.geminiLive = null;
    }

    this.status = 'enabled';
    this.connectedAt = new Date().toISOString();
    this.logger('info', 'Vision interface started');
  }

  async stop(): Promise<void> {
    if (this.vision) {
      this.vision.stopLiveSession();
      this.vision = null;
    }
    if (this.geminiLive) {
      await this.geminiLive.disconnect();
      this.geminiLive = null;
    }
    this.status = 'disabled';
    this.logger('info', 'Vision interface stopped');
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    this.logger('debug', `Vision response: ${response.content.slice(0, 100)}`);
  }

  async analyzeImage(image: Buffer, prompt: string): Promise<string> {
    if (!this.vision) throw new Error('Vision interface not started');
    return this.vision.analyzeImage(image, prompt);
  }

  async pushImage(image: Buffer, prompt: string): Promise<void> {
    if (!this.vision) throw new Error('Vision interface not started');
    const result = await this.vision.analyzeImage(image, prompt);
    const message: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'vision',
      chatId: 'vision-analysis',
      userId: 'vision',
      content: result,
      type: 'text',
      timestamp: new Date().toISOString(),
    };
    await this.dispatchMessage(message);
  }

  async analyzeLive(imageBase64: string, prompt: string): Promise<string> {
    // Try GeminiLive first (WebSocket), fallback to REST
    if (this.geminiLive) {
      try {
        // Lazy connect on first use
        if (!this.geminiLive.isConnected()) {
          await this.geminiLive.connect();
          this.logger('info', 'GeminiLive connected');
        }

        const result = await this.geminiLive.sendImage(imageBase64, 'image/png', prompt);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger('warn', `GeminiLive failed, falling back to REST: ${msg}`);
      }
    }

    // Fallback to REST API
    if (!this.vision) throw new Error('Vision interface not started');
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    return this.vision.analyzeImage(imageBuffer, prompt);
  }
}
