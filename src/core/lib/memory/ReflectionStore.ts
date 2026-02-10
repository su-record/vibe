// Self-Reflection storage for evolution system (Phase 1)
// Stores minor (context pressure) and major (session end) reflections

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { MemoryStorage } from './MemoryStorage.js';

export type ReflectionType = 'minor' | 'major';
export type ReflectionTrigger = 'context_pressure' | 'session_end' | 'manual';

export interface Reflection {
  id: string;
  sessionId: string | null;
  type: ReflectionType;
  trigger: ReflectionTrigger;
  insights: string[];
  decisions: string[];
  patterns: string[];
  filesContext: string[];
  score: number;
  createdAt: string;
}

export interface ReflectionInput {
  sessionId?: string;
  type: ReflectionType;
  trigger: ReflectionTrigger;
  insights?: string[];
  decisions?: string[];
  patterns?: string[];
  filesContext?: string[];
  score?: number;
}

interface ReflectionRow {
  id: string;
  sessionId: string | null;
  type: string;
  trigger: string;
  insights: string | null;
  decisions: string | null;
  patterns: string | null;
  filesContext: string | null;
  score: number;
  createdAt: string;
}

const MAX_MINOR_CHARS = 2000;
const MAX_MAJOR_CHARS = 8000;

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const uuid = randomUUID().replace(/-/g, '').slice(0, 12);
  return `${timestamp}-${uuid}`;
}

function truncateArray(arr: string[], maxChars: number): string[] {
  const json = JSON.stringify(arr);
  if (json.length <= maxChars) return arr;

  const result: string[] = [];
  let totalLen = 2; // for []
  for (const item of arr) {
    const itemLen = JSON.stringify(item).length + (result.length > 0 ? 1 : 0);
    if (totalLen + itemLen > maxChars) break;
    result.push(item);
    totalLen += itemLen;
  }
  return result;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export class ReflectionStore {
  private db: Database.Database;
  private fts5Available: boolean;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
    this.fts5Available = storage.isFTS5Available();
  }

  /**
   * Save a reflection to the database
   */
  public save(input: ReflectionInput): string {
    const id = generateId();
    const createdAt = new Date().toISOString();
    const maxChars = input.type === 'minor' ? MAX_MINOR_CHARS : MAX_MAJOR_CHARS;

    // Sanitize and validate JSON arrays
    const insights = truncateArray(sanitizeStringArray(input.insights), maxChars);
    const decisions = truncateArray(sanitizeStringArray(input.decisions), maxChars);
    const patterns = truncateArray(sanitizeStringArray(input.patterns), maxChars);
    const filesContext = sanitizeStringArray(input.filesContext);

    const score = typeof input.score === 'number'
      ? Math.max(0, Math.min(1, input.score))
      : 0.5;

    try {
      this.db.prepare(`
        INSERT INTO reflections (id, sessionId, type, trigger, insights, decisions, patterns, filesContext, score, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.sessionId || null,
        input.type,
        input.trigger,
        JSON.stringify(insights),
        JSON.stringify(decisions),
        JSON.stringify(patterns),
        JSON.stringify(filesContext),
        score,
        createdAt
      );
      return id;
    } catch (error) {
      const sqliteError = error as { code?: string };
      if (sqliteError.code === 'SQLITE_BUSY') {
        // Retry once after 100ms
        try {
          const { execSync } = require('child_process');
          execSync('sleep 0.1 2>nul || timeout /t 0 >nul 2>&1', { timeout: 200 });
        } catch {
          // sleep not available, just continue
        }
        try {
          this.db.prepare(`
            INSERT INTO reflections (id, sessionId, type, trigger, insights, decisions, patterns, filesContext, score, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            input.sessionId || null,
            input.type,
            input.trigger,
            JSON.stringify(insights),
            JSON.stringify(decisions),
            JSON.stringify(patterns),
            JSON.stringify(filesContext),
            score,
            createdAt
          );
          return id;
        } catch {
          process.stderr.write(`[ReflectionStore] SQLITE_BUSY retry failed\n`);
          throw error;
        }
      }
      throw error;
    }
  }

  /**
   * Search reflections using FTS5 (with LIKE fallback)
   */
  public search(query: string, limit: number = 20): Reflection[] {
    if (this.fts5Available) {
      try {
        const rows = this.db.prepare(`
          SELECT r.*, bm25(reflections_fts) as rank
          FROM reflections_fts fts
          JOIN reflections r ON r.rowid = fts.rowid
          WHERE reflections_fts MATCH ?
          ORDER BY r.score DESC, rank
          LIMIT ?
        `).all(query, limit) as ReflectionRow[];
        return rows.map(this.rowToReflection);
      } catch {
        // FTS5 query failed, fallback to LIKE
      }
    }

    const pattern = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT * FROM reflections
      WHERE insights LIKE ? OR decisions LIKE ? OR patterns LIKE ?
      ORDER BY score DESC, createdAt DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, limit) as ReflectionRow[];
    return rows.map(this.rowToReflection);
  }

  /**
   * Get reflections by session ID
   */
  public getBySession(sessionId: string): Reflection[] {
    const rows = this.db.prepare(`
      SELECT * FROM reflections WHERE sessionId = ?
      ORDER BY createdAt DESC
    `).all(sessionId) as ReflectionRow[];
    return rows.map(this.rowToReflection);
  }

  /**
   * Get most recent reflections
   */
  public getRecent(limit: number = 10): Reflection[] {
    const rows = this.db.prepare(`
      SELECT * FROM reflections
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limit) as ReflectionRow[];
    return rows.map(this.rowToReflection);
  }

  /**
   * Get high-value reflections (score >= minScore)
   */
  public getHighValue(minScore: number = 0.7, limit: number = 10): Reflection[] {
    const rows = this.db.prepare(`
      SELECT * FROM reflections
      WHERE score >= ?
      ORDER BY score DESC, createdAt DESC
      LIMIT ?
    `).all(minScore, limit) as ReflectionRow[];
    return rows.map(this.rowToReflection);
  }

  /**
   * Get a reflection by ID
   */
  public getById(id: string): Reflection | null {
    const row = this.db.prepare(`SELECT * FROM reflections WHERE id = ?`).get(id) as ReflectionRow | undefined;
    return row ? this.rowToReflection(row) : null;
  }

  /**
   * Get reflection count
   */
  public getCount(): number {
    const result = this.db.prepare(`SELECT COUNT(*) as cnt FROM reflections`).get() as { cnt: number };
    return result.cnt;
  }

  private rowToReflection(row: ReflectionRow): Reflection {
    return {
      id: row.id,
      sessionId: row.sessionId,
      type: row.type as ReflectionType,
      trigger: row.trigger as ReflectionTrigger,
      insights: row.insights ? JSON.parse(row.insights) : [],
      decisions: row.decisions ? JSON.parse(row.decisions) : [],
      patterns: row.patterns ? JSON.parse(row.patterns) : [],
      filesContext: row.filesContext ? JSON.parse(row.filesContext) : [],
      score: row.score,
      createdAt: row.createdAt,
    };
  }
}
