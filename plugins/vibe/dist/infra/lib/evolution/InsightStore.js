// Insight storage for self-evolution Phase 2
// Stores extracted patterns, anti-patterns, skill gaps, and optimizations
import { randomUUID } from 'crypto';
function generateId() {
    const timestamp = Date.now().toString(36);
    const uuid = randomUUID().replace(/-/g, '').slice(0, 12);
    return `ins-${timestamp}-${uuid}`;
}
export class InsightStore {
    db;
    fts5Available;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.fts5Available = storage.isFTS5Available();
        this.initializeTables();
    }
    initializeTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('pattern','anti_pattern','preference','skill_gap','optimization')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT,
        confidence REAL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1),
        occurrences INTEGER DEFAULT 1,
        tags TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','applied','deprecated')),
        generatedFrom TEXT NOT NULL CHECK(generatedFrom IN ('reflection','observation','agent_stats','manual')),
        appliedAs TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ins_type ON insights(type);
      CREATE INDEX IF NOT EXISTS idx_ins_status ON insights(status);
      CREATE INDEX IF NOT EXISTS idx_ins_confidence ON insights(confidence);
      CREATE INDEX IF NOT EXISTS idx_ins_created ON insights(createdAt);
      CREATE INDEX IF NOT EXISTS idx_ins_source ON insights(generatedFrom);
    `);
        // Skill gaps table for prompt-dispatcher miss logging
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_gaps (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        normalizedPrompt TEXT,
        sessionId TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sg_normalized ON skill_gaps(normalizedPrompt);
      CREATE INDEX IF NOT EXISTS idx_sg_created ON skill_gaps(createdAt);
    `);
        if (this.fts5Available) {
            try {
                this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS insights_fts
            USING fts5(title, description, tags, content=insights, content_rowid=rowid);

          CREATE TRIGGER IF NOT EXISTS insights_ai AFTER INSERT ON insights BEGIN
            INSERT INTO insights_fts(rowid, title, description, tags)
              VALUES (new.rowid, new.title, new.description, new.tags);
          END;
          CREATE TRIGGER IF NOT EXISTS insights_ad AFTER DELETE ON insights BEGIN
            INSERT INTO insights_fts(insights_fts, rowid, title, description, tags)
              VALUES('delete', old.rowid, old.title, old.description, old.tags);
          END;
          CREATE TRIGGER IF NOT EXISTS insights_au AFTER UPDATE ON insights BEGIN
            INSERT INTO insights_fts(insights_fts, rowid, title, description, tags)
              VALUES('delete', old.rowid, old.title, old.description, old.tags);
            INSERT INTO insights_fts(rowid, title, description, tags)
              VALUES (new.rowid, new.title, new.description, new.tags);
          END;
        `);
            }
            catch {
                // FTS5 setup failed, continue without it
            }
        }
    }
    save(input) {
        const id = generateId();
        const now = new Date().toISOString();
        const confidence = Math.max(0, Math.min(1, input.confidence ?? 0.5));
        this.db.prepare(`
      INSERT INTO insights (id, type, title, description, evidence, confidence, occurrences, tags, status, generatedFrom, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'draft', ?, ?, ?)
    `).run(id, input.type, input.title, input.description, JSON.stringify(input.evidence ?? []), confidence, JSON.stringify(input.tags ?? []), input.generatedFrom, now, now);
        return id;
    }
    /**
     * Check for duplicate and merge (increment occurrences) if found
     * Returns existing ID if merged, null if no duplicate
     */
    findAndMergeDuplicate(title, description) {
        if (this.fts5Available) {
            try {
                const row = this.db.prepare(`
          SELECT i.id, i.occurrences, i.confidence
          FROM insights_fts fts
          JOIN insights i ON i.rowid = fts.rowid
          WHERE insights_fts MATCH ?
          ORDER BY bm25(insights_fts)
          LIMIT 1
        `).get(title);
                if (row) {
                    const newOccurrences = row.occurrences + 1;
                    const newConfidence = Math.min(1.0, newOccurrences * 0.2 + 0.1);
                    this.db.prepare(`
            UPDATE insights SET occurrences = ?, confidence = ?, updatedAt = ? WHERE id = ?
          `).run(newOccurrences, newConfidence, new Date().toISOString(), row.id);
                    return row.id;
                }
            }
            catch {
                // FTS5 failed, treat as no duplicate
            }
        }
        return null;
    }
    search(query, limit = 20) {
        if (this.fts5Available) {
            try {
                const rows = this.db.prepare(`
          SELECT i.*, bm25(insights_fts) as rank
          FROM insights_fts fts
          JOIN insights i ON i.rowid = fts.rowid
          WHERE insights_fts MATCH ?
          ORDER BY i.confidence DESC, rank
          LIMIT ?
        `).all(query, limit);
                return rows.map(this.rowToInsight);
            }
            catch {
                // Fallback to LIKE
            }
        }
        const pattern = `%${query}%`;
        const rows = this.db.prepare(`
      SELECT * FROM insights
      WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?
      ORDER BY confidence DESC, createdAt DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, limit);
        return rows.map(this.rowToInsight);
    }
    getById(id) {
        const row = this.db.prepare(`SELECT * FROM insights WHERE id = ?`).get(id);
        return row ? this.rowToInsight(row) : null;
    }
    getActionable() {
        const rows = this.db.prepare(`
      SELECT * FROM insights
      WHERE status = 'confirmed' AND type IN ('skill_gap', 'pattern', 'anti_pattern')
      ORDER BY confidence DESC, occurrences DESC
      LIMIT 20
    `).all();
        return rows.map(this.rowToInsight);
    }
    getByStatus(status, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM insights WHERE status = ? ORDER BY updatedAt DESC LIMIT ?
    `).all(status, limit);
        return rows.map(this.rowToInsight);
    }
    getByType(type, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM insights WHERE type = ? ORDER BY confidence DESC LIMIT ?
    `).all(type, limit);
        return rows.map(this.rowToInsight);
    }
    updateStatus(id, status) {
        const result = this.db.prepare(`
      UPDATE insights SET status = ?, updatedAt = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);
        return result.changes > 0;
    }
    setAppliedAs(id, generationId) {
        const result = this.db.prepare(`
      UPDATE insights SET appliedAs = ?, status = 'applied', updatedAt = ? WHERE id = ?
    `).run(generationId, new Date().toISOString(), id);
        return result.changes > 0;
    }
    cleanupLowConfidence(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const cutoff = new Date(Date.now() - maxAge).toISOString();
        const result = this.db.prepare(`
      DELETE FROM insights WHERE confidence < 0.3 AND createdAt < ?
    `).run(cutoff);
        return result.changes;
    }
    getStats() {
        const types = this.db.prepare(`SELECT type, COUNT(*) as count FROM insights GROUP BY type`).all();
        const statuses = this.db.prepare(`SELECT status, COUNT(*) as count FROM insights GROUP BY status`).all();
        const byType = {};
        const byStatus = {};
        let total = 0;
        types.forEach(t => { byType[t.type] = t.count; total += t.count; });
        statuses.forEach(s => { byStatus[s.status] = s.count; });
        return { total, byType, byStatus };
    }
    rowToInsight(row) {
        return {
            id: row.id,
            type: row.type,
            title: row.title,
            description: row.description,
            evidence: row.evidence ? JSON.parse(row.evidence) : [],
            confidence: row.confidence,
            occurrences: row.occurrences,
            tags: row.tags ? JSON.parse(row.tags) : [],
            status: row.status,
            generatedFrom: row.generatedFrom,
            appliedAs: row.appliedAs,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}
//# sourceMappingURL=InsightStore.js.map