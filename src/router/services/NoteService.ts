/**
 * NoteService - SQLite-based quick note management
 * LLM auto-categorization and tagging
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.vibe', 'notes.db');

export interface Note {
  id: number;
  content: string;
  tags: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export class NoteService {
  private db: Database.Database;
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike | null;

  constructor(logger: InterfaceLogger, dbPath?: string, smartRouter?: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter ?? null;
    const resolvedPath = dbPath ?? DEFAULT_DB_PATH;
    this.ensureDir(resolvedPath);
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  /** Save a note with optional auto-tagging */
  async save(content: string): Promise<Note> {
    const { tags, category } = await this.autoClassify(content);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'INSERT INTO notes (content, tags, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(content, tags.join(','), category, now, now);
    this.logger('info', `메모 저장: ${content.slice(0, 50)}...`);
    return {
      id: Number(result.lastInsertRowid),
      content,
      tags: tags.join(','),
      category,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** List notes (optional category filter) */
  list(category?: string, limit: number = 20): Note[] {
    if (category) {
      const stmt = this.db.prepare(
        'SELECT * FROM notes WHERE category = ? ORDER BY createdAt DESC LIMIT ?',
      );
      return stmt.all(category, limit) as Note[];
    }
    const stmt = this.db.prepare('SELECT * FROM notes ORDER BY createdAt DESC LIMIT ?');
    return stmt.all(limit) as Note[];
  }

  /** Search notes by content or tags */
  search(query: string): Note[] {
    const stmt = this.db.prepare(
      'SELECT * FROM notes WHERE content LIKE ? OR tags LIKE ? ORDER BY createdAt DESC LIMIT 20',
    );
    const pattern = `%${query}%`;
    return stmt.all(pattern, pattern) as Note[];
  }

  /** Delete a note */
  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  /** Close database */
  close(): void {
    this.db.close();
  }

  private async autoClassify(content: string): Promise<{ tags: string[]; category: string }> {
    if (!this.smartRouter) {
      return { tags: [], category: 'general' };
    }
    try {
      const result = await this.smartRouter.route({
        type: 'reasoning',
        systemPrompt: CLASSIFY_PROMPT,
        prompt: content,
      });
      if (!result.success) return { tags: [], category: 'general' };
      return this.parseClassification(result.content);
    } catch {
      return { tags: [], category: 'general' };
    }
  }

  private parseClassification(response: string): { tags: string[]; category: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.fallbackParse(response);
      const parsed = JSON.parse(jsonMatch[0]) as { tags?: string[]; category?: string };
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        category: parsed.category ?? 'general',
      };
    } catch {
      return this.fallbackParse(response);
    }
  }

  private fallbackParse(response: string): { tags: string[]; category: string } {
    const tags = response.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
    return { tags, category: 'general' };
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(createdAt);
    `);
  }

  private ensureDir(dbPath: string): void {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

const CLASSIFY_PROMPT = `주어진 메모를 분석하여 태그와 카테고리를 JSON으로 반환하세요.
형식: {"tags": ["태그1", "태그2"], "category": "카테고리"}
카테고리: work, personal, idea, meeting, todo, reference, general
태그: 3-5개의 관련 키워드`;
