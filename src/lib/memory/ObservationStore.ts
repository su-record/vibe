// Structured observation storage for automatic tool-use capture
// Inspired by claude-mem's observation model

import Database from 'better-sqlite3';
import { MemoryStorage } from './MemoryStorage.js';

export type ObservationType = 'decision' | 'bugfix' | 'feature' | 'refactor' | 'discovery';

export interface Observation {
  id: number;
  sessionId: string | null;
  type: ObservationType;
  title: string;
  narrative: string | null;
  facts: string[];
  concepts: string[];
  filesModified: string[];
  timestamp: string;
  projectPath: string | null;
}

export interface ObservationInput {
  sessionId?: string;
  type: ObservationType;
  title: string;
  narrative?: string;
  facts?: string[];
  concepts?: string[];
  filesModified?: string[];
  projectPath?: string;
}

interface ObservationRow {
  id: number;
  sessionId: string | null;
  type: string;
  title: string;
  narrative: string | null;
  facts: string | null;
  concepts: string | null;
  filesModified: string | null;
  timestamp: string;
  projectPath: string | null;
}

export class ObservationStore {
  private db: Database.Database;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
  }

  /**
   * Add a new observation
   */
  public add(input: ObservationInput): number {
    const timestamp = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO observations (sessionId, type, title, narrative, facts, concepts, filesModified, timestamp, projectPath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.sessionId || null,
      input.type,
      input.title,
      input.narrative || null,
      input.facts ? JSON.stringify(input.facts) : null,
      input.concepts ? JSON.stringify(input.concepts) : null,
      input.filesModified ? JSON.stringify(input.filesModified) : null,
      timestamp,
      input.projectPath || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get observations by session ID
   */
  public getBySession(sessionId: string, limit: number = 50): Observation[] {
    const rows = this.db.prepare(`
      SELECT * FROM observations WHERE sessionId = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(sessionId, limit) as ObservationRow[];

    return rows.map(this.rowToObservation);
  }

  /**
   * Get recent observations
   */
  public getRecent(limit: number = 10, type?: ObservationType): Observation[] {
    if (type) {
      const rows = this.db.prepare(`
        SELECT * FROM observations WHERE type = ?
        ORDER BY timestamp DESC LIMIT ?
      `).all(type, limit) as ObservationRow[];
      return rows.map(this.rowToObservation);
    }

    const rows = this.db.prepare(`
      SELECT * FROM observations
      ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as ObservationRow[];

    return rows.map(this.rowToObservation);
  }

  /**
   * Get observations by type
   */
  public getByType(type: ObservationType, limit: number = 20): Observation[] {
    const rows = this.db.prepare(`
      SELECT * FROM observations WHERE type = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(type, limit) as ObservationRow[];

    return rows.map(this.rowToObservation);
  }

  /**
   * Search observations using FTS5 (with LIKE fallback)
   */
  public search(query: string, limit: number = 20): Observation[] {
    try {
      const rows = this.db.prepare(`
        SELECT o.*, bm25(observations_fts) as rank
        FROM observations_fts fts
        JOIN observations o ON o.id = fts.rowid
        WHERE observations_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit) as ObservationRow[];

      return rows.map(this.rowToObservation);
    } catch {
      // FTS5 not available, fallback to LIKE
      const pattern = `%${query}%`;
      const rows = this.db.prepare(`
        SELECT * FROM observations
        WHERE title LIKE ? OR narrative LIKE ? OR facts LIKE ? OR concepts LIKE ?
        ORDER BY timestamp DESC LIMIT ?
      `).all(pattern, pattern, pattern, pattern, limit) as ObservationRow[];

      return rows.map(this.rowToObservation);
    }
  }

  /**
   * Get observation statistics
   */
  public getStats(): { total: number; byType: Record<string, number> } {
    const types = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM observations GROUP BY type
    `).all() as Array<{ type: string; count: number }>;

    const byType: Record<string, number> = {};
    let total = 0;
    types.forEach(t => {
      byType[t.type] = t.count;
      total += t.count;
    });

    return { total, byType };
  }

  /**
   * Delete observations by session ID
   */
  public deleteBySession(sessionId: string): number {
    const result = this.db.prepare(`DELETE FROM observations WHERE sessionId = ?`).run(sessionId);
    return result.changes;
  }

  private rowToObservation(row: ObservationRow): Observation {
    return {
      id: row.id,
      sessionId: row.sessionId,
      type: row.type as ObservationType,
      title: row.title,
      narrative: row.narrative,
      facts: row.facts ? JSON.parse(row.facts) : [],
      concepts: row.concepts ? JSON.parse(row.concepts) : [],
      filesModified: row.filesModified ? JSON.parse(row.filesModified) : [],
      timestamp: row.timestamp,
      projectPath: row.projectPath,
    };
  }
}
