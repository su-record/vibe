// Self-Reflection storage for evolution system (Phase 1)
// Stores minor (context pressure) and major (session end) reflections
import { randomUUID } from 'crypto';
const MAX_MINOR_CHARS = 2000;
const MAX_MAJOR_CHARS = 8000;
function generateId() {
    const timestamp = Date.now().toString(36);
    const uuid = randomUUID().replace(/-/g, '').slice(0, 12);
    return `${timestamp}-${uuid}`;
}
function truncateArray(arr, maxChars) {
    const json = JSON.stringify(arr);
    if (json.length <= maxChars)
        return arr;
    const result = [];
    let totalLen = 2; // for []
    for (const item of arr) {
        const itemLen = JSON.stringify(item).length + (result.length > 0 ? 1 : 0);
        if (totalLen + itemLen > maxChars)
            break;
        result.push(item);
        totalLen += itemLen;
    }
    return result;
}
function sanitizeStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string');
}
export class ReflectionStore {
    db;
    fts5Available;
    constructor(storage) {
        this.db = storage.getDatabase();
        this.fts5Available = storage.isFTS5Available();
    }
    /**
     * Save a reflection to the database
     */
    save(input) {
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
        // SQLITE_BUSY 재시도는 SQLite 레벨에 위임 — MemoryStorage가 busy_timeout=5000
        // pragma를 설정하므로 SQLite가 최대 5초간 자체 재시도한다. 그 후에도 BUSY면
        // 즉시 1회 더 시도해도 의미가 없고, 수동 busy-wait 루프는 이벤트 루프만 블로킹한다.
        this.db.prepare(`
      INSERT INTO reflections (id, sessionId, type, trigger, insights, decisions, patterns, filesContext, score, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.sessionId || null, input.type, input.trigger, JSON.stringify(insights), JSON.stringify(decisions), JSON.stringify(patterns), JSON.stringify(filesContext), score, createdAt);
        return id;
    }
    /**
     * Search reflections using FTS5 (with LIKE fallback)
     */
    search(query, limit = 20) {
        if (this.fts5Available) {
            try {
                const rows = this.db.prepare(`
          SELECT r.*, bm25(reflections_fts) as rank
          FROM reflections_fts fts
          JOIN reflections r ON r.rowid = fts.rowid
          WHERE reflections_fts MATCH ?
          ORDER BY r.score DESC, rank
          LIMIT ?
        `).all(query, limit);
                return rows.map(this.rowToReflection);
            }
            catch {
                // FTS5 query failed, fallback to LIKE
            }
        }
        const pattern = `%${query}%`;
        const rows = this.db.prepare(`
      SELECT * FROM reflections
      WHERE insights LIKE ? OR decisions LIKE ? OR patterns LIKE ?
      ORDER BY score DESC, createdAt DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, limit);
        return rows.map(this.rowToReflection);
    }
    /**
     * Get reflections by session ID
     */
    getBySession(sessionId) {
        const rows = this.db.prepare(`
      SELECT * FROM reflections WHERE sessionId = ?
      ORDER BY createdAt DESC
    `).all(sessionId);
        return rows.map(this.rowToReflection);
    }
    /**
     * Get most recent reflections
     */
    getRecent(limit = 10) {
        const rows = this.db.prepare(`
      SELECT * FROM reflections
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limit);
        return rows.map(this.rowToReflection);
    }
    /**
     * Get high-value reflections (score >= minScore)
     */
    getHighValue(minScore = 0.7, limit = 10) {
        const rows = this.db.prepare(`
      SELECT * FROM reflections
      WHERE score >= ?
      ORDER BY score DESC, createdAt DESC
      LIMIT ?
    `).all(minScore, limit);
        return rows.map(this.rowToReflection);
    }
    /**
     * Get a reflection by ID
     */
    getById(id) {
        const row = this.db.prepare(`SELECT * FROM reflections WHERE id = ?`).get(id);
        return row ? this.rowToReflection(row) : null;
    }
    /**
     * Get reflection count
     */
    getCount() {
        const result = this.db.prepare(`SELECT COUNT(*) as cnt FROM reflections`).get();
        return result.cnt;
    }
    rowToReflection(row) {
        return {
            id: row.id,
            sessionId: row.sessionId,
            type: row.type,
            trigger: row.trigger,
            insights: row.insights ? JSON.parse(row.insights) : [],
            decisions: row.decisions ? JSON.parse(row.decisions) : [],
            patterns: row.patterns ? JSON.parse(row.patterns) : [],
            filesContext: row.filesContext ? JSON.parse(row.filesContext) : [],
            score: row.score,
            createdAt: row.createdAt,
        };
    }
}
//# sourceMappingURL=ReflectionStore.js.map