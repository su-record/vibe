// Core memory storage operations (CRUD)
// Extracted from MemoryManager for better separation of concerns
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, readFileSync, renameSync, existsSync } from 'fs';
import { VectorStore } from '../embedding/VectorStore.js';
import { EmbeddingProvider } from '../embedding/EmbeddingProvider.js';
export class MemoryStorage {
    db;
    dbPath;
    recallStmt = null;
    saveStmt = null;
    recallSelectStmt = null;
    recallUpdateStmt = null;
    fts5Available = false;
    vectorStore = null;
    embeddingProvider = null;
    /**
     * 프로젝트 메모리 디렉토리 해석 — `utils.js:projectMemoryDir` 와 동일한 규칙.
     * `.vibe/memories/` (SSOT) 우선, legacy `.claude/memories/` fallback.
     */
    static resolveMemoryDir(projectPath) {
        try {
            const candidates = [
                path.join(projectPath, '.vibe', 'memories'),
                path.join(projectPath, '.claude', 'memories'),
            ];
            for (const c of candidates)
                if (existsSync(c))
                    return c;
        }
        catch { /* ignore */ }
        return path.join(projectPath, '.vibe', 'memories');
    }
    constructor(projectPath, embeddingPriority) {
        // Normalize path
        const resolvedPath = path.resolve(projectPath);
        // Project-based memory: `.vibe/memories/` (새 SSOT) 를 기본으로,
        // 기존 `.claude/memories/` 가 있으면 거기에 기록.
        const memoryDir = MemoryStorage.resolveMemoryDir(resolvedPath);
        this.dbPath = path.join(memoryDir, 'memories.db');
        try {
            mkdirSync(memoryDir, { recursive: true });
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code !== 'EEXIST') {
                throw new Error(`Failed to create memory directory: ${nodeError.message}`);
            }
        }
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.db.pragma('foreign_keys = ON');
        this.initializeDatabase();
        this.migrateFromJSON();
        this.pruneOldRows();
        this.initializeEmbedding(embeddingPriority);
    }
    // ─── Retention prune ───
    // WHY: observations/reflections/usage_events/session_* 테이블은 쓰기 전용으로만
    // 누적되어 DB·WAL이 무한 성장한다. 세션 컨텍스트의 가치는 수 주 내에 소멸하므로
    // TTL 후 삭제한다. 매 초기화마다 돌면 낭비이므로 24시간 게이트로 최대 1회/일 실행.
    static DAY_MS = 24 * 60 * 60 * 1000;
    static PRUNE_INTERVAL_MS = MemoryStorage.DAY_MS;
    static SESSION_RETENTION_DAYS = 30;
    /**
     * 테이블별 보존 기간. session_* / conversation_history 는 SessionRAGStore가
     * 같은 DB에 생성하므로 존재할 때만 prune (sqlite_master 확인).
     * - 세션 산출물 30일: 세션 회고/관찰의 참조 빈도는 수 주 내 0에 수렴
     * - session_summaries 90일: 장기 회고용으로 가장 오래 보존
     * - conversation_history 2일: 기존 cleanupOldConversationHistory(48h)와 동일 정책
     */
    static PRUNE_TARGETS = [
        { table: 'observations', column: 'timestamp', days: 30 },
        { table: 'reflections', column: 'createdAt', days: 30 },
        { table: 'usage_events', column: 'createdAt', days: 30 },
        { table: 'session_summaries', column: 'timestamp', days: 90 },
        { table: 'session_decisions', column: 'timestamp', days: 30 },
        { table: 'session_constraints', column: 'timestamp', days: 30 },
        { table: 'session_evidence', column: 'timestamp', days: 30 },
        { table: 'conversation_history', column: 'timestamp', days: 2 },
    ];
    pruneOldRows() {
        try {
            this.db.exec(`CREATE TABLE IF NOT EXISTS maintenance_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
            const last = this.db
                .prepare(`SELECT value FROM maintenance_meta WHERE key = 'lastPruneAt'`)
                .get();
            const now = Date.now();
            if (last && now - Date.parse(last.value) < MemoryStorage.PRUNE_INTERVAL_MS)
                return;
            const tableExists = this.db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`);
            for (const { table, column, days } of MemoryStorage.PRUNE_TARGETS) {
                try {
                    if (!tableExists.get(table))
                        continue;
                    const cutoff = new Date(now - days * MemoryStorage.DAY_MS).toISOString();
                    this.db.prepare(`DELETE FROM ${table} WHERE ${column} < ?`).run(cutoff);
                }
                catch { /* 테이블 단위 실패(FK 등)는 건너뛰고 다음 prune 주기에 재시도 */ }
            }
            // session_goals는 self-FK(parentId)가 있어 자식이 남은 부모는 보존
            try {
                if (tableExists.get('session_goals')) {
                    const cutoff = new Date(now - MemoryStorage.SESSION_RETENTION_DAYS * MemoryStorage.DAY_MS).toISOString();
                    this.db.prepare(`DELETE FROM session_goals WHERE timestamp < ?
               AND id NOT IN (SELECT parentId FROM session_goals WHERE parentId IS NOT NULL)`).run(cutoff);
                }
            }
            catch { /* 다음 주기에 재시도 */ }
            this.db.prepare(`INSERT OR REPLACE INTO maintenance_meta (key, value) VALUES ('lastPruneAt', ?)`).run(new Date(now).toISOString());
        }
        catch { /* prune 실패가 초기화를 막아선 안 됨 */ }
    }
    initializeDatabase() {
        // Create memories table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        timestamp TEXT NOT NULL,
        lastAccessed TEXT NOT NULL,
        priority INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON memories(timestamp);
      CREATE INDEX IF NOT EXISTS idx_priority ON memories(priority);
      CREATE INDEX IF NOT EXISTS idx_lastAccessed ON memories(lastAccessed);
    `);
        // Create memory_relations table for Knowledge Graph
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceKey TEXT NOT NULL,
        targetKey TEXT NOT NULL,
        relationType TEXT NOT NULL,
        strength REAL DEFAULT 1.0,
        metadata TEXT,
        timestamp TEXT NOT NULL,
        UNIQUE(sourceKey, targetKey, relationType)
      );

      CREATE INDEX IF NOT EXISTS idx_rel_source ON memory_relations(sourceKey);
      CREATE INDEX IF NOT EXISTS idx_rel_target ON memory_relations(targetKey);
      CREATE INDEX IF NOT EXISTS idx_rel_type ON memory_relations(relationType);
    `);
        // Create observations table for structured observation capture
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        type TEXT NOT NULL CHECK(type IN ('decision','bugfix','feature','refactor','discovery')),
        title TEXT NOT NULL,
        narrative TEXT,
        facts TEXT,
        concepts TEXT,
        filesModified TEXT,
        timestamp TEXT NOT NULL,
        projectPath TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(sessionId);
      CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_obs_timestamp ON observations(timestamp);
    `);
        // Create session_summaries table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT UNIQUE NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        nextSteps TEXT,
        filesRead TEXT,
        filesEdited TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ss_session ON session_summaries(sessionId);
      CREATE INDEX IF NOT EXISTS idx_ss_timestamp ON session_summaries(timestamp);
    `);
        // Create usage_events table for self-evolution (Phase 4)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        generationId TEXT NOT NULL,
        sessionId TEXT,
        matchedPrompt TEXT,
        feedback TEXT CHECK(feedback IN ('positive','negative','neutral') OR feedback IS NULL),
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ue_gen ON usage_events(generationId);
      CREATE INDEX IF NOT EXISTS idx_ue_session ON usage_events(sessionId);
      CREATE INDEX IF NOT EXISTS idx_ue_feedback ON usage_events(feedback);
      CREATE INDEX IF NOT EXISTS idx_ue_created ON usage_events(createdAt);
    `);
        // Create reflections table for self-evolution (Phase 1)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS reflections (
        id TEXT PRIMARY KEY,
        sessionId TEXT,
        type TEXT NOT NULL CHECK(type IN ('minor','major')),
        trigger TEXT NOT NULL CHECK(trigger IN ('context_pressure','session_end','manual')),
        insights TEXT,
        decisions TEXT,
        patterns TEXT,
        filesContext TEXT,
        score REAL DEFAULT 0.5 CHECK(score >= 0 AND score <= 1),
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_refl_session ON reflections(sessionId);
      CREATE INDEX IF NOT EXISTS idx_refl_type ON reflections(type);
      CREATE INDEX IF NOT EXISTS idx_refl_trigger ON reflections(trigger);
      CREATE INDEX IF NOT EXISTS idx_refl_score ON reflections(score);
      CREATE INDEX IF NOT EXISTS idx_refl_created ON reflections(createdAt);
    `);
        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');
        // Initialize FTS5 full-text search (with fallback if not supported)
        this.initializeFTS5();
        // Pre-compile frequently used statements
        this.initializePreparedStatements();
    }
    initializeFTS5() {
        try {
            // Create FTS5 virtual table for memories
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
          USING fts5(key, value, content=memories, content_rowid=rowid);
      `);
            // Triggers to keep FTS5 in sync with memories table
            this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, key, value) VALUES (new.rowid, new.key, new.value);
        END;
        CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, key, value) VALUES('delete', old.rowid, old.key, old.value);
        END;
        CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, key, value) VALUES('delete', old.rowid, old.key, old.value);
          INSERT INTO memories_fts(rowid, key, value) VALUES (new.rowid, new.key, new.value);
        END;
      `);
            // Create FTS5 for observations
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts
          USING fts5(title, narrative, facts, concepts, content=observations, content_rowid=id);

        CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
          INSERT INTO observations_fts(rowid, title, narrative, facts, concepts)
            VALUES (new.id, new.title, new.narrative, new.facts, new.concepts);
        END;
        CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
          INSERT INTO observations_fts(observations_fts, rowid, title, narrative, facts, concepts)
            VALUES('delete', old.id, old.title, old.narrative, old.facts, old.concepts);
        END;
      `);
            // Create FTS5 for reflections
            this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS reflections_fts
          USING fts5(insights, decisions, patterns, content=reflections, content_rowid=rowid);

        CREATE TRIGGER IF NOT EXISTS reflections_ai AFTER INSERT ON reflections BEGIN
          INSERT INTO reflections_fts(rowid, insights, decisions, patterns)
            VALUES (new.rowid, new.insights, new.decisions, new.patterns);
        END;
        CREATE TRIGGER IF NOT EXISTS reflections_ad AFTER DELETE ON reflections BEGIN
          INSERT INTO reflections_fts(reflections_fts, rowid, insights, decisions, patterns)
            VALUES('delete', old.rowid, old.insights, old.decisions, old.patterns);
        END;
        CREATE TRIGGER IF NOT EXISTS reflections_au AFTER UPDATE ON reflections BEGIN
          INSERT INTO reflections_fts(reflections_fts, rowid, insights, decisions, patterns)
            VALUES('delete', old.rowid, old.insights, old.decisions, old.patterns);
          INSERT INTO reflections_fts(rowid, insights, decisions, patterns)
            VALUES (new.rowid, new.insights, new.decisions, new.patterns);
        END;
      `);
            // Migrate existing data into FTS5 index
            const ftsCount = this.db.prepare(`SELECT COUNT(*) as cnt FROM memories_fts`).get().cnt;
            const memCount = this.db.prepare(`SELECT COUNT(*) as cnt FROM memories`).get().cnt;
            if (ftsCount === 0 && memCount > 0) {
                this.db.exec(`INSERT INTO memories_fts(rowid, key, value) SELECT rowid, key, value FROM memories`);
            }
            const obsFtsCount = this.db.prepare(`SELECT COUNT(*) as cnt FROM observations_fts`).get().cnt;
            const obsCount = this.db.prepare(`SELECT COUNT(*) as cnt FROM observations`).get().cnt;
            if (obsFtsCount === 0 && obsCount > 0) {
                this.db.exec(`INSERT INTO observations_fts(rowid, title, narrative, facts, concepts) SELECT id, title, narrative, facts, concepts FROM observations`);
            }
            this.fts5Available = true;
        }
        catch {
            // FTS5 not supported in this build of better-sqlite3
            this.fts5Available = false;
        }
    }
    initializePreparedStatements() {
        try {
            this.recallStmt = this.db.prepare(`
        UPDATE memories SET lastAccessed = ?
        WHERE key = ?
        RETURNING *
      `);
        }
        catch {
            // RETURNING not supported, use fallback
            this.recallStmt = null;
            this.recallSelectStmt = this.db.prepare(`SELECT * FROM memories WHERE key = ?`);
            this.recallUpdateStmt = this.db.prepare(`UPDATE memories SET lastAccessed = ? WHERE key = ?`);
        }
        this.saveStmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (key, value, category, timestamp, lastAccessed, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    }
    migrateFromJSON() {
        const jsonPath = path.join(path.dirname(this.dbPath), 'memories.json');
        if (!existsSync(jsonPath))
            return;
        try {
            const jsonData = readFileSync(jsonPath, 'utf-8');
            const memories = JSON.parse(jsonData);
            if (memories.length === 0)
                return;
            const insert = this.db.prepare(`
        INSERT OR REPLACE INTO memories (key, value, category, timestamp, lastAccessed, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            const insertMany = this.db.transaction((items) => {
                for (const item of items) {
                    insert.run(item.key, item.value, item.category || 'general', item.timestamp, item.lastAccessed, item.priority || 0);
                }
            });
            insertMany(memories);
            renameSync(jsonPath, `${jsonPath}.backup`);
        }
        catch {
            // Migration failed, ignore
        }
    }
    initializeEmbedding(priority) {
        try {
            this.embeddingProvider = new EmbeddingProvider(priority ? { priority } : undefined);
            if (this.embeddingProvider.isAvailable()) {
                this.vectorStore = new VectorStore(this.db);
            }
            else {
                this.embeddingProvider = null;
            }
        }
        catch {
            this.embeddingProvider = null;
            this.vectorStore = null;
        }
    }
    /**
     * VectorStore 인스턴스 (벡터 검색 불가 시 null)
     */
    getVectorStore() {
        return this.vectorStore;
    }
    /**
     * EmbeddingProvider 인스턴스 (API 키 없으면 null)
     */
    getEmbeddingProvider() {
        return this.embeddingProvider;
    }
    /**
     * 벡터 검색 사용 가능 여부
     */
    isVectorAvailable() {
        return this.vectorStore !== null && this.embeddingProvider !== null;
    }
    /**
     * 비동기 임베딩 생성 + 벡터 저장 (실패 무시)
     */
    embedAndStoreAsync(key, text) {
        if (!this.embeddingProvider || !this.vectorStore)
            return;
        const provider = this.embeddingProvider;
        const store = this.vectorStore;
        void (async () => {
            try {
                const result = await provider.embed([text]);
                if (result.embeddings.length > 0) {
                    store.saveMemoryVector(key, result.embeddings[0]);
                }
            }
            catch {
                // 임베딩 실패 → 무시 (메모리 저장은 이미 성공)
            }
        })();
    }
    /**
     * Save or update a memory item
     */
    save(key, value, category = 'general', priority = 0) {
        const timestamp = new Date().toISOString();
        if (this.saveStmt) {
            this.saveStmt.run(key, value, category, timestamp, timestamp, priority);
        }
        else {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories (key, value, category, timestamp, lastAccessed, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(key, value, category, timestamp, timestamp, priority);
        }
        this.embedAndStoreAsync(key, `${key}: ${value}`);
    }
    /**
     * Recall a memory item by key
     */
    recall(key) {
        const timestamp = new Date().toISOString();
        if (this.recallStmt) {
            const result = this.recallStmt.get(timestamp, key);
            return result || null;
        }
        if (!this.recallSelectStmt || !this.recallUpdateStmt) {
            throw new Error('Fallback recall statements not initialized');
        }
        const result = this.recallSelectStmt.get(key);
        if (result) {
            this.recallUpdateStmt.run(timestamp, key);
        }
        return result || null;
    }
    /**
     * Delete a memory item
     */
    delete(key) {
        // Also delete related relations
        this.db.prepare(`DELETE FROM memory_relations WHERE sourceKey = ? OR targetKey = ?`).run(key, key);
        // Delete vector if exists
        if (this.vectorStore) {
            this.vectorStore.deleteMemoryVector(key);
        }
        const stmt = this.db.prepare(`DELETE FROM memories WHERE key = ?`);
        const result = stmt.run(key);
        return result.changes > 0;
    }
    /**
     * Update a memory item's value
     */
    update(key, value) {
        const timestamp = new Date().toISOString();
        const stmt = this.db.prepare(`
      UPDATE memories
      SET value = ?, timestamp = ?, lastAccessed = ?
      WHERE key = ?
    `);
        const result = stmt.run(value, timestamp, timestamp, key);
        return result.changes > 0;
    }
    /**
     * List all memories or filter by category
     */
    list(category) {
        if (category) {
            const stmt = this.db.prepare(`
        SELECT * FROM memories WHERE category = ?
        ORDER BY priority DESC, timestamp DESC
      `);
            return stmt.all(category);
        }
        else {
            const stmt = this.db.prepare(`
        SELECT * FROM memories
        ORDER BY priority DESC, timestamp DESC
      `);
            return stmt.all();
        }
    }
    /**
     * Search memories by keyword (FTS5 priority, LIKE fallback)
     */
    search(query) {
        if (this.fts5Available) {
            try {
                return this.searchFTS(query);
            }
            catch {
                // FTS5 query failed, fall through to LIKE
            }
        }
        return this.searchLike(query);
    }
    /**
     * Sanitize FTS5 query to prevent query syntax injection.
     * Removes special FTS5 operators and syntax characters.
     */
    static sanitizeFTS5Query(query) {
        const sanitized = query.replace(/["*(){}[\]^~:<>]/g, ' ').trim();
        if (!sanitized)
            return '""';
        return sanitized;
    }
    /**
     * Full-text search using FTS5 with bm25 ranking
     */
    searchFTS(query, limit = 50) {
        if (!this.fts5Available) {
            return this.searchLike(query);
        }
        const stmt = this.db.prepare(`
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
        return stmt.all(MemoryStorage.sanitizeFTS5Query(query), limit);
    }
    /**
     * Check if FTS5 is available
     */
    isFTS5Available() {
        return this.fts5Available;
    }
    searchLike(query) {
        const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE key LIKE ? OR value LIKE ?
      ORDER BY priority DESC, timestamp DESC
    `);
        const pattern = `%${query}%`;
        return stmt.all(pattern, pattern);
    }
    /**
     * Get memories by priority level
     */
    getByPriority(priority) {
        const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE priority = ?
      ORDER BY timestamp DESC
    `);
        return stmt.all(priority);
    }
    /**
     * Update priority of a memory item
     */
    setPriority(key, priority) {
        const stmt = this.db.prepare(`UPDATE memories SET priority = ? WHERE key = ?`);
        const result = stmt.run(priority, key);
        return result.changes > 0;
    }
    /**
     * Get memory statistics
     */
    getStats() {
        const categories = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM memories
      GROUP BY category
    `).all();
        const byCategory = {};
        let total = 0;
        categories.forEach(cat => {
            byCategory[cat.category] = cat.count;
            total += cat.count;
        });
        return { total, byCategory };
    }
    /**
     * Get memories sorted by time
     */
    getTimeline(startDate, endDate, limit = 50) {
        let sql = `SELECT * FROM memories WHERE 1=1`;
        const params = [];
        if (startDate) {
            sql += ` AND timestamp >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND timestamp <= ?`;
            params.push(endDate);
        }
        sql += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);
        return this.db.prepare(sql).all(...params);
    }
    /**
     * Get database instance (for KnowledgeGraph)
     */
    getDatabase() {
        return this.db;
    }
    /**
     * Get database path
     */
    getDbPath() {
        return this.dbPath;
    }
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}
//# sourceMappingURL=MemoryStorage.js.map