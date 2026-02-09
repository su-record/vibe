/**
 * ConversationStore - SQLite 기반 대화 이력 영구 저장
 * Phase 4: Persistence Layer
 *
 * 기능:
 * - SQLite + WAL mode
 * - 슬라이딩 윈도우: 최근 20개 메시지
 * - 세션 만료: 30분 비활성 (configurable)
 * - 민감정보 마스킹: API keys, tokens, secrets
 * - 자동 만료 세션 정리
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import type { AgentMessage } from './types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const DEFAULT_DB_PATH = path.join(VIBE_DIR, 'conversations.db');
const MAX_MESSAGES = 20; // sliding window
const DEFAULT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const CREDENTIAL_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|auth|credential)\s*[=:]\s*['"]?(\S{8,})/gi,
  /(?:sk-|xox[bpsa]-|ghp_|gho_|Bearer\s+)\S+/g,
];

export class ConversationStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? DEFAULT_DB_PATH;

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversations (
        chatId TEXT PRIMARY KEY,
        messages TEXT NOT NULL DEFAULT '[]',
        lastActivity INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_activity ON conversations(lastActivity);
    `);

    // Record schema version
    const existing = this.db.prepare('SELECT version FROM schema_version WHERE version = 1').get();
    if (!existing) {
      this.db.prepare('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, ?)').run(Date.now());
    }
  }

  addMessage(chatId: string, message: AgentMessage): void {
    const existing = this.db.prepare('SELECT messages FROM conversations WHERE chatId = ?').get(chatId) as { messages: string } | undefined;

    let messages: AgentMessage[] = [];
    if (existing) {
      messages = JSON.parse(existing.messages) as AgentMessage[];
    }

    // Mask sensitive fields before storing
    const maskedMessage = this.maskSensitive(message);
    messages.push(maskedMessage);

    // Apply sliding window
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }

    const json = JSON.stringify(messages);

    this.db.prepare(`
      INSERT INTO conversations (chatId, messages, lastActivity)
      VALUES (?, ?, ?)
      ON CONFLICT(chatId) DO UPDATE SET messages = excluded.messages, lastActivity = excluded.lastActivity
    `).run(chatId, json, Date.now());
  }

  getMessages(chatId: string, _provider?: string): AgentMessage[] {
    const row = this.db.prepare('SELECT messages FROM conversations WHERE chatId = ?').get(chatId) as { messages: string } | undefined;
    if (!row) return [];
    return JSON.parse(row.messages) as AgentMessage[];
  }

  isSessionExpired(chatId: string, expiryMs?: number): boolean {
    const expiry = expiryMs ?? DEFAULT_EXPIRY_MS;
    const row = this.db.prepare('SELECT lastActivity FROM conversations WHERE chatId = ?').get(chatId) as { lastActivity: number } | undefined;
    if (!row) return true;
    return Date.now() - row.lastActivity > expiry;
  }

  resetSession(chatId: string): void {
    this.db.prepare('DELETE FROM conversations WHERE chatId = ?').run(chatId);
  }

  clearSession(chatId: string): void {
    this.resetSession(chatId);
  }

  cleanExpired(expiryMs?: number): number {
    const expiry = expiryMs ?? DEFAULT_EXPIRY_MS;
    const cutoff = Date.now() - expiry;
    const result = this.db.prepare('DELETE FROM conversations WHERE lastActivity < ?').run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }

  private maskSensitive(message: AgentMessage): AgentMessage {
    const masked = { ...message };
    if (masked.content) {
      let content = masked.content;
      for (const pattern of CREDENTIAL_PATTERNS) {
        content = content.replace(pattern, '***MASKED***');
      }
      masked.content = content;
    }
    return masked;
  }

  /**
   * Test helper: manually set lastActivity for expired session testing
   * @internal
   */
  _setLastActivityForTest(chatId: string, timestamp: number): void {
    this.db.prepare('UPDATE conversations SET lastActivity = ? WHERE chatId = ?').run(timestamp, chatId);
  }
}
