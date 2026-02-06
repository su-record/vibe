/**
 * BaseInterface - Abstract class for external interfaces
 * Phase 4: External Interface
 *
 * All external interfaces (Telegram, Web, Webhook) extend this.
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

export type MessageHandler = (message: ExternalMessage) => Promise<void>;

export abstract class BaseInterface implements ExternalInterface {
  abstract readonly name: string;
  abstract readonly channel: ChannelType;

  protected status: InterfaceStatus = 'disabled';
  protected connectedAt?: string;
  protected lastActivity?: string;
  protected logger: InterfaceLogger;
  private messageHandler?: MessageHandler;

  constructor(logger: InterfaceLogger) {
    this.logger = logger;
  }

  /** Register handler for incoming messages */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /** Dispatch incoming message to handler */
  protected async dispatchMessage(message: ExternalMessage): Promise<void> {
    this.lastActivity = new Date().toISOString();

    if (!this.messageHandler) {
      this.logger('warn', `No message handler registered for ${this.name}`);
      return;
    }

    try {
      await this.messageHandler(message);
    } catch (err) {
      this.logger('error', `Error handling message on ${this.name}`, {
        error: err instanceof Error ? err.message : String(err),
      });
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
