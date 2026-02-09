/**
 * IMessageBot - iMessage interface for Vibe
 * Phase 4: External Interface
 *
 * Uses `imsg rpc` CLI (JSON-RPC 2.0 over stdin/stdout) instead of
 * directly accessing chat.db. This avoids Full Disk Access requirements.
 *
 * Based on openclaw's proven approach:
 * - Spawns `imsg rpc` subprocess
 * - Calls `watch.subscribe` to receive incoming messages
 * - Calls `send` to deliver replies
 */

import * as crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { BaseInterface } from '../BaseInterface.js';
import {
  ChannelType,
  ExternalMessage,
  ExternalResponse,
  InterfaceLogger,
  IMessageConfig,
} from '../types.js';
import { IMessageRpcClient, createIMessageRpcClient } from './IMessageRpcClient.js';
import { IMessageFormatter } from './IMessageFormatter.js';

interface IMessagePayload {
  id?: number | null;
  chat_id?: number | null;
  sender?: string | null;
  is_from_me?: boolean | null;
  text?: string | null;
  created_at?: string | null;
  attachments?: Array<{
    original_path?: string | null;
    mime_type?: string | null;
    missing?: boolean | null;
  }> | null;
  chat_identifier?: string | null;
  chat_guid?: string | null;
  chat_name?: string | null;
  participants?: string[] | null;
  is_group?: boolean | null;
}

export class IMessageBot extends BaseInterface {
  readonly name = 'imessage';
  readonly channel: ChannelType = 'imessage';

  private config: IMessageConfig;
  private client?: IMessageRpcClient;
  private subscriptionId: number | null = null;
  private formatter: IMessageFormatter;
  private phoneRegex = /^\+?[\d\s\-()]{10,20}$/;
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(config: IMessageConfig, logger: InterfaceLogger) {
    super(logger);
    this.config = config;
    this.formatter = new IMessageFormatter();
  }

  async start(): Promise<void> {
    // Platform check: Only macOS supported
    if (process.platform !== 'darwin') {
      this.logger('warn', 'iMessage interface only available on macOS - interface disabled');
      this.status = 'disabled';
      return;
    }

    // Cloud mode check
    if (process.env.VIBE_AUTH_MODE === 'cloud') {
      this.logger('warn', 'iMessage interface disabled in cloud mode');
      this.status = 'disabled';
      return;
    }

    this.status = 'connecting';
    this.logger('info', 'Starting iMessage bot via imsg rpc...');

    const cliPath = this.config.cliPath || 'imsg';

    // Probe: check if imsg binary exists
    const probeOk = await this.probeImsg(cliPath);
    if (!probeOk) {
      this.logger('error', `imsg CLI not found at "${cliPath}". Install: brew install su-record/tap/imsg`);
      this.status = 'error';
      return;
    }

    try {
      // Create RPC client with notification handler
      this.client = await createIMessageRpcClient({
        cliPath,
        dbPath: this.config.dbPath,
        onNotification: (msg) => {
          if (msg.method === 'message') {
            const params = msg.params as { message?: IMessagePayload | null };
            const message = params?.message ?? null;
            if (message) {
              void this.handleIncomingMessage(message).catch((err) => {
                this.logger('error', `iMessage handler failed: ${err instanceof Error ? err.message : String(err)}`);
              });
            }
          } else if (msg.method === 'error') {
            this.logger('error', `imsg rpc watch error: ${JSON.stringify(msg.params)}`);
          }
        },
        onError: (msg) => {
          this.logger('warn', msg);
        },
      });

      // Subscribe to new messages
      const result = await this.client.request<{ subscription?: number }>('watch.subscribe', {
        attachments: true,
      });
      this.subscriptionId = result?.subscription ?? null;

      this.status = 'enabled';
      this.connectedAt = new Date().toISOString();
      this.logger('info', `iMessage bot started via imsg rpc (subscription: ${this.subscriptionId})`);

      // Keep alive until client closes (non-blocking)
      void this.client.waitForClose().then(() => {
        if (this.status === 'enabled') {
          this.logger('warn', 'imsg rpc process closed unexpectedly');
          this.status = 'error';
        }
      });
    } catch (err) {
      this.status = 'error';
      this.logger('error', `Failed to start iMessage bot: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.client && this.subscriptionId !== null) {
      try {
        await this.client.request('watch.unsubscribe', {
          subscription: this.subscriptionId,
        });
      } catch {
        // Ignore errors during shutdown
      }
    }

    if (this.client) {
      await this.client.stop();
      this.client = undefined;
    }

    this.subscriptionId = null;
    this.status = 'disabled';
    this.logger('info', 'iMessage bot stopped');
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    if (!this.client) {
      this.logger('warn', 'Cannot send iMessage response: RPC client not running');
      return;
    }

    const plainText = this.formatter.toPlainText(response.content);
    const chunks = this.formatter.splitMessage(plainText);

    for (const chunk of chunks) {
      try {
        await this.client.request('send', {
          to: response.chatId,
          text: chunk,
        });
      } catch (err) {
        this.logger('error', `Failed to send iMessage: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    }
  }

  // ========================================================================
  // Private
  // ========================================================================

  private async handleIncomingMessage(payload: IMessagePayload): Promise<void> {
    // Skip our own messages
    if (payload.is_from_me) return;

    const sender = payload.sender?.trim();
    if (!sender) return;

    // Validate handle format
    if (!this.isValidHandle(sender)) {
      this.logger('warn', `Skipping message with invalid handle: ${sender}`);
      return;
    }

    // Check allowlist (empty = allow all on macOS)
    if (!this.isAuthorizedHandle(sender)) {
      this.logger('warn', `Rejected message from unauthorized handle: ${sender}`);
      return;
    }

    const content = payload.text?.trim() || '';
    const metadata: Record<string, unknown> = {};

    if (payload.id) metadata.imessageId = payload.id;
    if (payload.chat_id) metadata.chatId = payload.chat_id;
    if (payload.is_group) metadata.isGroup = payload.is_group;
    if (payload.chat_name) metadata.chatName = payload.chat_name;

    // Handle attachments
    if (payload.attachments && payload.attachments.length > 0) {
      const validAttachments = payload.attachments
        .filter((a) => a.original_path && !a.missing)
        .map((a) => a.original_path as string);
      if (validAttachments.length > 0) {
        metadata.attachments = validAttachments;
      }
    }

    const messageContent = content || (metadata.attachments ? `[${(metadata.attachments as string[]).length} attachment(s)]` : '');
    if (!messageContent) return;

    // Determine chatId: group chat_id or sender handle
    const chatId = payload.chat_id ? String(payload.chat_id) : sender;
    const timestamp = payload.created_at
      ? new Date(payload.created_at).toISOString()
      : new Date().toISOString();

    const externalMessage: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'imessage',
      chatId,
      userId: sender,
      content: messageContent,
      type: 'text',
      metadata,
      timestamp,
    };

    await this.dispatchMessage(externalMessage);
  }

  private isValidHandle(handle: string): boolean {
    return this.phoneRegex.test(handle) || this.emailRegex.test(handle);
  }

  private isAuthorizedHandle(handle: string): boolean {
    // allowedHandles empty = allow all (macOS auto-connect)
    if (this.config.allowedHandles.length === 0) return true;
    return this.config.allowedHandles.includes(handle);
  }

  private probeImsg(cliPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(cliPath, ['--version'], { timeout: 5000 }, (err) => {
        if (err) {
          // Try 'which' as fallback
          execFile('which', [cliPath], { timeout: 3000 }, (whichErr) => {
            resolve(!whichErr);
          });
          return;
        }
        resolve(true);
      });
    });
  }
}
