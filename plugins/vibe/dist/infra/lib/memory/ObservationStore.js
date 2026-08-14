// Structured observation storage for automatic tool-use capture
export class ObservationStore {
    db;
    constructor(storage) {
        this.db = storage.getDatabase();
    }
    /**
     * Add a new observation
     */
    add(input) {
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO observations (sessionId, type, title, narrative, facts, concepts, filesModified, timestamp, projectPath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.sessionId || null, input.type, input.title, input.narrative || null, input.facts ? JSON.stringify(input.facts) : null, input.concepts ? JSON.stringify(input.concepts) : null, input.filesModified ? JSON.stringify(input.filesModified) : null, timestamp, input.projectPath || null);
        return result.lastInsertRowid;
    }
    /**
     * Get observations by session ID
     */
    getBySession(sessionId, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM observations WHERE sessionId = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(sessionId, limit);
        return rows.map(this.rowToObservation);
    }
    /**
     * Get recent observations
     */
    getRecent(limit = 10, type) {
        if (type) {
            const rows = this.db.prepare(`
        SELECT * FROM observations WHERE type = ?
        ORDER BY timestamp DESC LIMIT ?
      `).all(type, limit);
            return rows.map(this.rowToObservation);
        }
        const rows = this.db.prepare(`
      SELECT * FROM observations
      ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
        return rows.map(this.rowToObservation);
    }
    /**
     * Get observations by type
     */
    getByType(type, limit = 20) {
        const rows = this.db.prepare(`
      SELECT * FROM observations WHERE type = ?
      ORDER BY timestamp DESC LIMIT ?
    `).all(type, limit);
        return rows.map(this.rowToObservation);
    }
    /**
     * Search observations using FTS5 (with LIKE fallback)
     */
    search(query, limit = 20) {
        try {
            const rows = this.db.prepare(`
        SELECT o.*, bm25(observations_fts) as rank
        FROM observations_fts fts
        JOIN observations o ON o.id = fts.rowid
        WHERE observations_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit);
            return rows.map(this.rowToObservation);
        }
        catch {
            // FTS5 not available, fallback to LIKE
            const pattern = `%${query}%`;
            const rows = this.db.prepare(`
        SELECT * FROM observations
        WHERE title LIKE ? OR narrative LIKE ? OR facts LIKE ? OR concepts LIKE ?
        ORDER BY timestamp DESC LIMIT ?
      `).all(pattern, pattern, pattern, pattern, limit);
            return rows.map(this.rowToObservation);
        }
    }
    /**
     * Get observation statistics
     */
    getStats() {
        const types = this.db.prepare(`
      SELECT type, COUNT(*) as count FROM observations GROUP BY type
    `).all();
        const byType = {};
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
    deleteBySession(sessionId) {
        const result = this.db.prepare(`DELETE FROM observations WHERE sessionId = ?`).run(sessionId);
        return result.changes;
    }
    rowToObservation(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            type: row.type,
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
//# sourceMappingURL=ObservationStore.js.map