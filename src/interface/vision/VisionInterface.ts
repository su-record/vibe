/**
 * VisionInterface - Vision channel implementation
 * Phase 4: External Interface
 */

import { BaseInterface } from '../BaseInterface.js';
import { ChannelType, ExternalMessage, ExternalResponse, InterfaceLogger } from '../types.js';
import { GeminiVision } from './GeminiVisionClass.js';
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
    this.status = 'enabled';
    this.connectedAt = new Date().toISOString();
    this.logger('info', 'Vision interface started');
  }

  async stop(): Promise<void> {
    if (this.vision) {
      this.vision.stopLiveSession();
      this.vision = null;
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
}
