/**
 * MultiChannelRouter - Multi-channel message routing
 * Phase 5: Integration & Multi-Channel
 */

import type { ChannelType, ExternalInterface, ExternalResponse, InterfaceLogger } from '../interface/types.js';
import type { ChannelSendOptions } from './types.js';

export interface BroadcastResult {
  sent: ChannelType[];
  failed: Array<{ channel: ChannelType; error: string }>;
}

export class MultiChannelRouter {
  private channels: Map<ChannelType, ExternalInterface>;
  private logger: InterfaceLogger;

  constructor(logger: InterfaceLogger) {
    this.logger = logger;
    this.channels = new Map();
  }

  /**
   * Register a channel interface
   */
  registerChannel(channel: ChannelType, iface: ExternalInterface): void {
    this.channels.set(channel, iface);
    this.logger('info', `[MultiChannelRouter] Registered channel: ${channel}`);
  }

  /**
   * Unregister a channel interface
   */
  unregisterChannel(channel: ChannelType): void {
    const removed = this.channels.delete(channel);
    if (removed) {
      this.logger('info', `[MultiChannelRouter] Unregistered channel: ${channel}`);
    }
  }

  /**
   * Get a channel interface
   */
  getChannel(channel: ChannelType): ExternalInterface | undefined {
    return this.channels.get(channel);
  }

  /**
   * Get all active channel types
   */
  getActiveChannels(): ChannelType[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Send message to a specific channel
   */
  async sendToChannel(
    channel: ChannelType,
    chatId: string,
    text: string,
    options?: ChannelSendOptions,
  ): Promise<void> {
    const iface = this.channels.get(channel);
    if (!iface) {
      throw new Error(`Channel not registered: ${channel}`);
    }

    const status = iface.getStatus();
    if (status !== 'enabled') {
      throw new Error(`Channel not enabled: ${channel} (status: ${status})`);
    }

    const response: ExternalResponse = {
      messageId: crypto.randomUUID(),
      channel,
      chatId,
      content: text,
      format: options?.format ?? 'text',
      metadata: options?.threadId ? { threadId: options.threadId } : undefined,
    };

    try {
      await iface.sendResponse(response);
      this.logger('info', `[MultiChannelRouter] Sent to ${channel}: ${chatId}`);
    } catch (error) {
      this.logger('error', `[MultiChannelRouter] Failed to send to ${channel}`, error);
      throw error;
    }
  }

  /**
   * Broadcast message to all active channels
   * Partial failure: collect errors but don't throw
   */
  async broadcast(
    chatId: string,
    text: string,
    options?: ChannelSendOptions,
  ): Promise<BroadcastResult> {
    const sent: ChannelType[] = [];
    const failed: Array<{ channel: ChannelType; error: string }> = [];

    const promises = Array.from(this.channels.entries()).map(async ([channel, iface]) => {
      try {
        const status = iface.getStatus();
        if (status !== 'enabled') {
          failed.push({ channel, error: `Channel not enabled (status: ${status})` });
          return;
        }

        const response: ExternalResponse = {
          messageId: crypto.randomUUID(),
          channel,
          chatId,
          content: text,
          format: options?.format ?? 'text',
          metadata: options?.threadId ? { threadId: options.threadId } : undefined,
        };

        await iface.sendResponse(response);
        sent.push(channel);
        this.logger('info', `[MultiChannelRouter] Broadcast to ${channel}: ${chatId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        failed.push({ channel, error: errorMsg });
        this.logger('error', `[MultiChannelRouter] Broadcast failed for ${channel}`, error);
      }
    });

    await Promise.all(promises);

    return { sent, failed };
  }

  /**
   * Start all registered channels
   * Continue on failures, log errors
   */
  async startAll(): Promise<void> {
    this.logger('info', '[MultiChannelRouter] Starting all channels...');
    const promises = Array.from(this.channels.entries()).map(async ([channel, iface]) => {
      try {
        await iface.start();
        this.logger('info', `[MultiChannelRouter] Started channel: ${channel}`);
      } catch (error) {
        this.logger('error', `[MultiChannelRouter] Failed to start ${channel}`, error);
      }
    });
    await Promise.all(promises);
  }

  /**
   * Stop all registered channels
   * Stop in sequence to avoid race conditions
   */
  async stopAll(): Promise<void> {
    this.logger('info', '[MultiChannelRouter] Stopping all channels...');
    for (const [channel, iface] of this.channels) {
      try {
        await iface.stop();
        this.logger('info', `[MultiChannelRouter] Stopped channel: ${channel}`);
      } catch (error) {
        this.logger('error', `[MultiChannelRouter] Failed to stop ${channel}`, error);
      }
    }
  }
}
