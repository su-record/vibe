// Generation Registry for self-evolution Phase 3
// Tracks generated skill/agent/rule artifacts
import { randomUUID } from 'crypto';
export class GenerationRegistry {
    db;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.initializeTables();
    }
    initializeTables() {
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
    save(input) {
        const id = `gen-${Date.now().toString(36)}-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        const now = new Date().toISOString();
        this.db.prepare(`
      INSERT INTO generations (id, insightId, type, name, content, filePath, status, qualityScore, triggerPatterns, ttlDays, version, parentId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.insightId, input.type, input.name, input.content, input.filePath || null, input.status || 'draft', input.qualityScore || 0, JSON.stringify(input.triggerPatterns || []), input.ttlDays || 7, input.parentId ? 2 : 1, // version 2 if has parent
        input.parentId || null, now, now);
        return id;
    }
    getById(id) {
        const row = this.db.prepare(`SELECT * FROM generations WHERE id = ?`).get(id);
        return row ? this.rowToGeneration(row) : null;
    }
    getByName(name) {
        const row = this.db.prepare(`SELECT * FROM generations WHERE name = ? AND status != 'deleted' ORDER BY version DESC LIMIT 1`).get(name);
        return row ? this.rowToGeneration(row) : null;
    }
    getActive(type) {
        let sql = `SELECT * FROM generations WHERE status IN ('active', 'testing')`;
        const params = [];
        if (type) {
            sql += ` AND type = ?`;
            params.push(type);
        }
        sql += ` ORDER BY updatedAt DESC`;
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToGeneration);
    }
    getByStatus(status, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM generations WHERE status = ? ORDER BY updatedAt DESC LIMIT ?
    `).all(status, limit);
        return rows.map(this.rowToGeneration);
    }
    updateStatus(id, status) {
        const result = this.db.prepare(`
      UPDATE generations SET status = ?, updatedAt = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);
        return result.changes > 0;
    }
    incrementUsage(id) {
        this.db.prepare(`
      UPDATE generations SET usageCount = usageCount + 1, lastUsedAt = ?, updatedAt = ? WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id);
    }
    getStats() {
        const types = this.db.prepare(`SELECT type, COUNT(*) as count FROM generations GROUP BY type`).all();
        const statuses = this.db.prepare(`SELECT status, COUNT(*) as count FROM generations GROUP BY status`).all();
        const byType = {};
        const byStatus = {};
        let total = 0;
        types.forEach(t => { byType[t.type] = t.count; total += t.count; });
        statuses.forEach(s => { byStatus[s.status] = s.count; });
        return { total, byType, byStatus };
    }
    getRecentFailures(limit = 10) {
        const result = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM generations
      WHERE status = 'deleted' AND createdAt > datetime('now', '-1 hour')
    `).get();
        return result.cnt;
    }
    rowToGeneration(row) {
        return {
            id: row.id,
            insightId: row.insightId,
            type: row.type,
            name: row.name,
            content: row.content,
            filePath: row.filePath,
            status: row.status,
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
//# sourceMappingURL=GenerationRegistry.js.map