import type Database from 'better-sqlite3';
import { uuidv7 } from 'uuidv7';

const MAX_SUGGESTIONS = 1000;
const DEDUP_WINDOW_MS = 86_400_000; // 24 hours

export type SuggestionType = 'security' | 'performance' | 'quality' | 'dependency' | 'pattern';
type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'auto_applied';

export interface SuggestionRow {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: number;
  evidence: string;
  suggestedAction: string | null;
  status: string;
  riskLevel: string;
  sourceModule: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateSuggestionInput {
  type: SuggestionType;
  title: string;
  description: string;
  priority: number;
  evidence: Record<string, unknown>;
  suggestedAction?: string;
  riskLevel?: string;
  sourceModule: string;
}

export interface SuggestionStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  pendingCount: number;
}

interface StorageProvider {
  getDatabase(): Database.Database;
}

export class SuggestionStore {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement;
  private fts5Available = false;

  constructor(storage: StorageProvider) {
    this.db = storage.getDatabase();
    this.initTables();
    this.insertStmt = this.db.prepare(`
      INSERT INTO suggestions
        (id, type, title, description, priority, evidence, suggestedAction, status, riskLevel, sourceModule, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('security','performance','quality','dependency','pattern')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 5),
        evidence TEXT NOT NULL,
        suggestedAction TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','dismissed','auto_applied')),
        riskLevel TEXT DEFAULT 'LOW',
        sourceModule TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        resolvedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_suggestion_status_priority ON suggestions(status, priority);
      CREATE INDEX IF NOT EXISTS idx_suggestion_type_created ON suggestions(type, createdAt);
    `);

    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS suggestions_fts USING fts5(
          title, description,
          content='suggestions', content_rowid='rowid'
        );
        CREATE TRIGGER IF NOT EXISTS suggestions_fts_ai AFTER INSERT ON suggestions BEGIN
          INSERT INTO suggestions_fts(rowid, title, description)
          VALUES (new.rowid, new.title, new.description);
        END;
      `);
      this.fts5Available = true;
    } catch {
      this.fts5Available = false;
    }
  }

  create(input: CreateSuggestionInput): SuggestionRow {
    const existing = this.findDuplicate(input.title, input.type);
    if (existing) return existing;

    this.enforceMaxSuggestions();

    const id = uuidv7();
    const now = new Date().toISOString();
    const priority = Math.max(1, Math.min(5, input.priority));

    this.insertStmt.run(
      id, input.type, input.title, input.description, priority,
      JSON.stringify(input.evidence), input.suggestedAction ?? null,
      input.riskLevel ?? 'LOW', input.sourceModule, now,
    );

    return this.getById(id)!;
  }

  resolve(id: string, status: SuggestionStatus): SuggestionRow {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE suggestions SET status = ?, resolvedAt = ? WHERE id = ?')
      .run(status, now, id);
    return this.getById(id)!;
  }

  getById(id: string): SuggestionRow | null {
    return (
      this.db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id) as SuggestionRow
    ) ?? null;
  }

  getPending(limit = 50): SuggestionRow[] {
    return this.db
      .prepare(
        "SELECT * FROM suggestions WHERE status = 'pending' ORDER BY priority ASC, createdAt ASC LIMIT ?",
      )
      .all(limit) as SuggestionRow[];
  }

  getHighPriority(maxPriority = 2): SuggestionRow[] {
    return this.db
      .prepare(
        "SELECT * FROM suggestions WHERE status = 'pending' AND priority <= ? ORDER BY priority ASC, createdAt ASC",
      )
      .all(maxPriority) as SuggestionRow[];
  }

  getStats(): SuggestionStats {
    const total = (
      this.db.prepare('SELECT COUNT(*) as count FROM suggestions').get() as { count: number }
    ).count;

    const byType = Object.fromEntries(
      (this.db
        .prepare('SELECT type, COUNT(*) as count FROM suggestions GROUP BY type')
        .all() as Array<{ type: string; count: number }>
      ).map((r) => [r.type, r.count]),
    );

    const byStatus = Object.fromEntries(
      (this.db
        .prepare('SELECT status, COUNT(*) as count FROM suggestions GROUP BY status')
        .all() as Array<{ status: string; count: number }>
      ).map((r) => [r.status, r.count]),
    );

    const pendingCount = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM suggestions WHERE status = 'pending'")
        .get() as { count: number }
    ).count;

    return { total, byType, byStatus, pendingCount };
  }

  search(query: string, limit = 50): SuggestionRow[] {
    if (!this.fts5Available) return [];
    const sanitized = query.replace(/[*"()\-]/g, ' ').trim();
    if (!sanitized) return [];
    try {
      return this.db
        .prepare(
          `SELECT s.* FROM suggestions s
           JOIN suggestions_fts f ON s.rowid = f.rowid
           WHERE suggestions_fts MATCH ?
           ORDER BY rank LIMIT ?`,
        )
        .all(sanitized, limit) as SuggestionRow[];
    } catch {
      return [];
    }
  }

  private findDuplicate(title: string, type: string): SuggestionRow | null {
    const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const rows = this.db
      .prepare('SELECT * FROM suggestions WHERE type = ? AND createdAt >= ? ORDER BY createdAt DESC')
      .all(type, cutoff) as SuggestionRow[];

    for (const row of rows) {
      const rowNormalized = row.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (rowNormalized === normalized) return row;
    }
    return null;
  }

  private enforceMaxSuggestions(): void {
    const total = (
      this.db.prepare('SELECT COUNT(*) as count FROM suggestions').get() as { count: number }
    ).count;

    if (total < MAX_SUGGESTIONS) return;

    const deleteOrder: SuggestionStatus[] = ['dismissed', 'auto_applied', 'accepted'];
    for (const status of deleteOrder) {
      const oldest = this.db
        .prepare('SELECT id FROM suggestions WHERE status = ? ORDER BY createdAt ASC LIMIT 1')
        .get(status) as { id: string } | undefined;
      if (oldest) {
        this.db.prepare('DELETE FROM suggestions WHERE id = ?').run(oldest.id);
        return;
      }
    }
  }
}
