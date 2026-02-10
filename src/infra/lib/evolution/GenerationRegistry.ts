// Generation Registry for self-evolution Phase 3
// Tracks generated skill/agent/rule artifacts

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { MemoryStorage } from '../memory/MemoryStorage.js';

export type GenerationType = 'skill' | 'agent' | 'rule';
export type GenerationStatus = 'draft' | 'testing' | 'active' | 'disabled' | 'deleted';

export interface Generation {
  id: string;
  insightId: string;
  type: GenerationType;
  name: string;
  content: string;
  filePath: string | null;
  status: GenerationStatus;
  qualityScore: number;
  triggerPatterns: string[];
  usageCount: number;
  lastUsedAt: string | null;
  ttlDays: number;
  version: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationInput {
  insightId: string;
  type: GenerationType;
  name: string;
  content: string;
  filePath?: string;
  status?: GenerationStatus;
  qualityScore?: number;
  triggerPatterns?: string[];
  ttlDays?: number;
  parentId?: string;
}

interface GenerationRow {
  id: string;
  insightId: string;
  type: string;
  name: string;
  content: string;
  filePath: string | null;
  status: string;
  qualityScore: number;
  triggerPatterns: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  ttlDays: number;
  version: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class GenerationRegistry {
  private db: Database.Database;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        insightId TEXT,
        type TEXT NOT NULL CHECK(type IN ('skill','agent','rule')),
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        filePath TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','testing','active','disabled','deleted')),
        qualityScore INTEGER DEFAULT 0,
        triggerPatterns TEXT,
        usageCount INTEGER DEFAULT 0,
        lastUsedAt TEXT,
        ttlDays INTEGER DEFAULT 7,
        version INTEGER DEFAULT 1,
        parentId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_gen_type ON generations(type);
      CREATE INDEX IF NOT EXISTS idx_gen_status ON generations(status);
      CREATE INDEX IF NOT EXISTS idx_gen_insight ON generations(insightId);
      CREATE INDEX IF NOT EXISTS idx_gen_name ON generations(name);
    `);
  }

  public save(input: GenerationInput): string {
    const id = `gen-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO generations (id, insightId, type, name, content, filePath, status, qualityScore, triggerPatterns, ttlDays, version, parentId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.insightId,
      input.type,
      input.name,
      input.content,
      input.filePath || null,
      input.status || 'draft',
      input.qualityScore || 0,
      JSON.stringify(input.triggerPatterns || []),
      input.ttlDays || 7,
      input.parentId ? 2 : 1, // version 2 if has parent
      input.parentId || null,
      now,
      now
    );
    return id;
  }

  public getById(id: string): Generation | null {
    const row = this.db.prepare(`SELECT * FROM generations WHERE id = ?`).get(id) as GenerationRow | undefined;
    return row ? this.rowToGeneration(row) : null;
  }

  public getByName(name: string): Generation | null {
    const row = this.db.prepare(`SELECT * FROM generations WHERE name = ? AND status != 'deleted' ORDER BY version DESC LIMIT 1`).get(name) as GenerationRow | undefined;
    return row ? this.rowToGeneration(row) : null;
  }

  public getActive(type?: GenerationType): Generation[] {
    let sql = `SELECT * FROM generations WHERE status IN ('active', 'testing')`;
    const params: unknown[] = [];
    if (type) { sql += ` AND type = ?`; params.push(type); }
    sql += ` ORDER BY updatedAt DESC`;
    const rows = this.db.prepare(sql).all(...params) as GenerationRow[];
    return rows.map(this.rowToGeneration);
  }

  public getByStatus(status: GenerationStatus, limit: number = 50): Generation[] {
    const rows = this.db.prepare(`
      SELECT * FROM generations WHERE status = ? ORDER BY updatedAt DESC LIMIT ?
    `).all(status, limit) as GenerationRow[];
    return rows.map(this.rowToGeneration);
  }

  public updateStatus(id: string, status: GenerationStatus): boolean {
    const result = this.db.prepare(`
      UPDATE generations SET status = ?, updatedAt = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);
    return result.changes > 0;
  }

  public incrementUsage(id: string): void {
    this.db.prepare(`
      UPDATE generations SET usageCount = usageCount + 1, lastUsedAt = ?, updatedAt = ? WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id);
  }

  public getStats(): { total: number; byType: Record<string, number>; byStatus: Record<string, number> } {
    const types = this.db.prepare(`SELECT type, COUNT(*) as count FROM generations GROUP BY type`).all() as Array<{ type: string; count: number }>;
    const statuses = this.db.prepare(`SELECT status, COUNT(*) as count FROM generations GROUP BY status`).all() as Array<{ status: string; count: number }>;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let total = 0;
    types.forEach(t => { byType[t.type] = t.count; total += t.count; });
    statuses.forEach(s => { byStatus[s.status] = s.count; });
    return { total, byType, byStatus };
  }

  public getRecentFailures(limit: number = 10): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM generations
      WHERE status = 'deleted' AND createdAt > datetime('now', '-1 hour')
    `).get() as { cnt: number };
    return result.cnt;
  }

  private rowToGeneration(row: GenerationRow): Generation {
    return {
      id: row.id,
      insightId: row.insightId,
      type: row.type as GenerationType,
      name: row.name,
      content: row.content,
      filePath: row.filePath,
      status: row.status as GenerationStatus,
      qualityScore: row.qualityScore,
      triggerPatterns: row.triggerPatterns ? JSON.parse(row.triggerPatterns) : [],
      usageCount: row.usageCount,
      lastUsedAt: row.lastUsedAt,
      ttlDays: row.ttlDays,
      version: row.version,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
