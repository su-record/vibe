/**
 * BookmarkService - SQLite-based URL bookmark management
 * Auto-summary + tag generation via LLM
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { InterfaceLogger } from '../../interface/types.js';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.vibe', 'bookmarks.db');
const MAX_WARN_COUNT = 10_000;

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  summary: string;
  tags: string;
  createdAt: string;
}

export class BookmarkService {
  private db: Database.Database;
  private logger: InterfaceLogger;

  constructor(logger: InterfaceLogger, dbPath?: string) {
    this.logger = logger;
    const resolvedPath = dbPath ?? DEFAULT_DB_PATH;
    this.ensureDir(resolvedPath);
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  /** Save a bookmark */
  save(url: string, title: string, summary: string, tags: string[]): number {
    this.warnIfExceeded();
    const stmt = this.db.prepare(
      'INSERT INTO bookmarks (url, title, summary, tags, createdAt) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(url, title, summary, tags.join(','), new Date().toISOString());
    this.logger('info', `북마크 저장: ${url}`);
    return Number(result.lastInsertRowid);
  }

  /** List bookmarks (optional tag filter) */
  list(tag?: string, limit: number = 20): Bookmark[] {
    if (tag) {
      const stmt = this.db.prepare(
        'SELECT * FROM bookmarks WHERE tags LIKE ? ORDER BY createdAt DESC LIMIT ?',
      );
      return stmt.all(`%${tag}%`, limit) as Bookmark[];
    }
    const stmt = this.db.prepare('SELECT * FROM bookmarks ORDER BY createdAt DESC LIMIT ?');
    return stmt.all(limit) as Bookmark[];
  }

  /** Full-text search bookmarks */
  search(query: string): Bookmark[] {
    const stmt = this.db.prepare(
      'SELECT * FROM bookmarks WHERE title LIKE ? OR summary LIKE ? OR tags LIKE ? ORDER BY createdAt DESC LIMIT 20',
    );
    const pattern = `%${query}%`;
    return stmt.all(pattern, pattern, pattern) as Bookmark[];
  }

  /** Delete a bookmark */
  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM bookmarks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /** Get bookmark count */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM bookmarks').get() as { cnt: number };
    return row.cnt;
  }

  /** Close database */
  close(): void {
    this.db.close();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON bookmarks(tags);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(createdAt);
    `);
  }

  private warnIfExceeded(): void {
    if (this.count() >= MAX_WARN_COUNT) {
      this.logger('warn', `북마크 수가 ${MAX_WARN_COUNT}개를 초과했습니다.`);
    }
  }

  private ensureDir(dbPath: string): void {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
