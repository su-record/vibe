/**
 * IMessageBot - iMessage interface for Vibe
 * Phase 4: External Interface
 *
 * Polling-based approach reading from macOS Messages.app SQLite database.
 * Security: Read-only DB access, handle allowlist, platform checks.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { BaseInterface } from '../BaseInterface.js';
import {
  ChannelType,
  ExternalMessage,
  ExternalResponse,
  InterfaceLogger,
  IMessageConfig,
} from '../types.js';
import { IMessageSender } from './IMessageSender.js';
import { IMessageFormatter } from './IMessageFormatter.js';

interface MessageRow {
  ROWID: number;
  text: string | null;
  handle_id: number;
  date: number;
  is_from_me: number;
  cache_roomnames: string | null;
  handle_value: string | null;
  attachments: string | null;
}

interface StateFile {
  lastRowId: number;
}

const POLLING_INTERVAL_MS = 3000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const MAX_ATTACHMENT_SIZE_MB = 10;

export class IMessageBot extends BaseInterface {
  readonly name = 'imessage';
  readonly channel: ChannelType = 'imessage';

  private config: IMessageConfig;
  private db?: DatabaseType;
  private pollingActive: boolean = false;
  private lastRowId: number = 0;
  private stateFilePath: string;
  private formatter: IMessageFormatter;
  private pollingIntervalHandle?: ReturnType<typeof setTimeout>;
  private phoneRegex = /^\+?[\d\s\-()]{10,20}$/;
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(config: IMessageConfig, logger: InterfaceLogger) {
    super(logger);
    this.config = config;
    this.formatter = new IMessageFormatter();
    this.stateFilePath = path.join(os.homedir(), '.claude', 'vibe', 'imessage-state.json');
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
    this.logger('info', 'Starting iMessage bot...');

    try {
      // Open Messages database
      const dbPath = this.config.dbPath || path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

      try {
        this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('SQLITE_CANTOPEN') || errMsg.includes('permission')) {
          this.logger('error', 'Failed to open Messages database - Full Disk Access required for Terminal/Claude Code in System Preferences > Security & Privacy > Privacy > Full Disk Access');
          this.status = 'error';
          return;
        }
        throw err;
      }

      // Restore last ROWID from state file
      await this.restoreState();

      // If no state, initialize with current max ROWID
      if (this.lastRowId === 0) {
        const result = this.db.prepare('SELECT MAX(ROWID) as maxId FROM message').get() as { maxId: number | null };
        this.lastRowId = result.maxId || 0;
        await this.saveState();
      }

      this.status = 'enabled';
      this.connectedAt = new Date().toISOString();
      this.logger('info', `iMessage bot started - monitoring from ROWID ${this.lastRowId}`);

      this.startPolling();
    } catch (err) {
      this.status = 'error';
      this.logger('error', `Failed to start iMessage bot: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.pollingActive = false;
    if (this.pollingIntervalHandle) {
      clearTimeout(this.pollingIntervalHandle);
      this.pollingIntervalHandle = undefined;
    }
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.status = 'disabled';
    this.logger('info', 'iMessage bot stopped');
  }

  async sendResponse(response: ExternalResponse): Promise<void> {
    const plainText = this.formatter.toPlainText(response.content);
    const chunks = this.formatter.splitMessage(plainText);

    for (const chunk of chunks) {
      await IMessageSender.send(response.chatId, chunk);
    }
  }

  // ========================================================================
  // Private
  // ========================================================================

  private startPolling(): void {
    this.pollingActive = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    if (!this.pollingActive || !this.db) return;

    try {
      const messages = await this.fetchNewMessages();

      for (const msg of messages) {
        await this.processMessage(msg);
        this.lastRowId = msg.ROWID;
        await this.saveState();
      }
    } catch (err) {
      this.logger('warn', `iMessage polling error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (this.pollingActive) {
      const interval = this.config.pollingIntervalMs || POLLING_INTERVAL_MS;
      this.pollingIntervalHandle = setTimeout(() => this.poll(), interval);
    }
  }

  private async fetchNewMessages(): Promise<MessageRow[]> {
    if (!this.db) return [];

    const query = `
      SELECT m.ROWID, m.text, m.handle_id, m.date, m.is_from_me, m.cache_roomnames,
             h.id as handle_value,
             (SELECT GROUP_CONCAT(a.filename, '|') FROM attachment a
              JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
              WHERE maj.message_id = m.ROWID) as attachments
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.ROWID > ? AND m.is_from_me = 0
      ORDER BY m.ROWID ASC
      LIMIT 50
    `;

    // Retry logic for DB locks
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const stmt = this.db.prepare(query);
        return stmt.all(this.lastRowId) as MessageRow[];
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('SQLITE_BUSY') && attempt < MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        throw err;
      }
    }

    return [];
  }

  private async processMessage(row: MessageRow): Promise<void> {
    // Validate handle
    const handle = row.handle_value;
    if (!handle || !this.isValidHandle(handle)) {
      this.logger('warn', `Skipping message with invalid handle: ${handle}`);
      return;
    }

    // Check allowlist
    if (!this.isAuthorizedHandle(handle)) {
      this.logger('warn', `Rejected message from unauthorized handle: ${handle}`);
      return;
    }

    // Parse message content
    let content = row.text || '';
    const metadata: Record<string, unknown> = {
      imessageRowId: row.ROWID,
      handleId: row.handle_id,
    };

    // Handle attachments
    if (row.attachments) {
      const attachmentPaths = row.attachments.split('|').filter(p => p);
      const validAttachments: string[] = [];

      for (const attachmentPath of attachmentPaths) {
        // Resolve ~ in path
        const fullPath = attachmentPath.startsWith('~')
          ? path.join(os.homedir(), attachmentPath.slice(1))
          : attachmentPath;

        try {
          const stats = await fs.stat(fullPath);
          const sizeMB = stats.size / (1024 * 1024);

          if (sizeMB <= MAX_ATTACHMENT_SIZE_MB) {
            validAttachments.push(fullPath);
          } else {
            this.logger('warn', `Skipping attachment (too large: ${sizeMB.toFixed(1)}MB): ${fullPath}`);
          }
        } catch {
          this.logger('warn', `Skipping inaccessible attachment: ${fullPath}`);
        }
      }

      if (validAttachments.length > 0) {
        metadata.attachments = validAttachments;
        if (!content) {
          content = `[${validAttachments.length} attachment(s)]`;
        }
      }
    }

    // Convert Apple epoch to Unix timestamp
    const unixTimestamp = this.appleEpochToUnix(row.date);

    // Determine chatId (use group name if available, else handle)
    const chatId = row.cache_roomnames || handle;

    const externalMessage: ExternalMessage = {
      id: crypto.randomUUID(),
      channel: 'imessage',
      chatId,
      userId: handle,
      content,
      type: 'text',
      metadata,
      timestamp: new Date(unixTimestamp * 1000).toISOString(),
    };

    await this.dispatchMessage(externalMessage);
  }

  private isValidHandle(handle: string): boolean {
    return this.phoneRegex.test(handle) || this.emailRegex.test(handle);
  }

  private isAuthorizedHandle(handle: string): boolean {
    // allowedHandles 비어있으면 전체 허용 (macOS 자동 연결)
    if (this.config.allowedHandles.length === 0) return true;
    return this.config.allowedHandles.includes(handle);
  }

  private appleEpochToUnix(appleDate: number): number {
    // Apple epoch: 2001-01-01 00:00:00 UTC
    // Convert nanoseconds to seconds and add Apple epoch offset
    return appleDate / 1000000000 + 978307200;
  }

  private async restoreState(): Promise<void> {
    try {
      const stateDir = path.dirname(this.stateFilePath);
      await fs.mkdir(stateDir, { recursive: true });

      const data = await fs.readFile(this.stateFilePath, 'utf-8');
      const state = JSON.parse(data) as StateFile;
      this.lastRowId = state.lastRowId || 0;
      this.logger('info', `Restored iMessage state: lastRowId=${this.lastRowId}`);
    } catch {
      // State file doesn't exist or is invalid - start fresh
      this.lastRowId = 0;
    }
  }

  private async saveState(): Promise<void> {
    try {
      const stateDir = path.dirname(this.stateFilePath);
      await fs.mkdir(stateDir, { recursive: true });

      const state: StateFile = { lastRowId: this.lastRowId };
      await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      this.logger('warn', `Failed to save iMessage state: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
