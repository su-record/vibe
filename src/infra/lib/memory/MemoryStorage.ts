// Core memory storage operations (CRUD)
// Extracted from MemoryManager for better separation of concerns

import type { IMemoryStorage } from './IMemoryStorage.js';
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, readFileSync, renameSync, existsSync } from 'fs';
import { VectorStore } from '../embedding/VectorStore.js';
import { EmbeddingProvider } from '../embedding/EmbeddingProvider.js';
import type { EmbeddingProviderType } from '../embedding/types.js';

export interface MemoryItem {
  key: string;
  value: string;
  category: string;
  timestamp: string;
  lastAccessed: string;
  priority?: number;
}

export class MemoryStorage implements IMemoryStorage {
  protected db: Database.Database;
  protected readonly dbPath: string;
  private recallStmt: Database.Statement | null = null;
  private saveStmt: Database.Statement | null = null;
  private recallSelectStmt: Database.Statement | null = null;
  private recallUpdateStmt: Database.Statement | null = null;
  private fts5Available = false;
  private vectorStore: VectorStore | null = null;
  private embeddingProvider: EmbeddingProvider | null = null;

  constructor(projectPath: string, embeddingPriority?: EmbeddingProviderType[]) {
    // Normalize path
    const resolvedPath = path.resolve(projectPath);

    // Project-based memory: store in {projectPath}/.claude/memories/
    const memoryDir = path.join(resolvedPath, '.claude', 'memories');
    this.dbPath = path.join(memoryDir, 'memories.db');

    try {
      mkdirSync(memoryDir, { recursive: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
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
    this.initializeEmbedding(embeddingPriority);
  }

  private initializeDatabase(): void {
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

  private initializeFTS5(): void {
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
      const ftsCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM memories_fts`).get() as { cnt: number }).cnt;
      const memCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM memories`).get() as { cnt: number }).cnt;
      if (ftsCount === 0 && memCount > 0) {
        this.db.exec(`INSERT INTO memories_fts(rowid, key, value) SELECT rowid, key, value FROM memories`);
      }

      const obsFtsCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM observations_fts`).get() as { cnt: number }).cnt;
      const obsCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM observations`).get() as { cnt: number }).cnt;
      if (obsFtsCount === 0 && obsCount > 0) {
        this.db.exec(`INSERT INTO observations_fts(rowid, title, narrative, facts, concepts) SELECT id, title, narrative, facts, concepts FROM observations`);
      }

      this.fts5Available = true;
    } catch {
      // FTS5 not supported in this build of better-sqlite3
      this.fts5Available = false;
    }
  }

  private initializePreparedStatements(): void {
    try {
      this.recallStmt = this.db.prepare(`
        UPDATE memories SET lastAccessed = ?
        WHERE key = ?
        RETURNING *
      `);
    } catch {
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

  private migrateFromJSON(): void {
    const jsonPath = path.join(path.dirname(this.dbPath), 'memories.json');

    if (!existsSync(jsonPath)) return;

    try {
      const jsonData = readFileSync(jsonPath, 'utf-8');
      const memories: MemoryItem[] = JSON.parse(jsonData);

      if (memories.length === 0) return;

      const insert = this.db.prepare(`
        INSERT OR REPLACE INTO memories (key, value, category, timestamp, lastAccessed, priority)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((items: MemoryItem[]) => {
        for (const item of items) {
          insert.run(
            item.key,
            item.value,
            item.category || 'general',
            item.timestamp,
            item.lastAccessed,
            item.priority || 0
          );
        }
      });

      insertMany(memories);
      renameSync(jsonPath, `${jsonPath}.backup`);
    } catch {
      // Migration failed, ignore
    }
  }

  private initializeEmbedding(priority?: EmbeddingProviderType[]): void {
    try {
      this.embeddingProvider = new EmbeddingProvider(
        priority ? { priority } : undefined,
      );
      if (this.embeddingProvider.isAvailable()) {
        this.vectorStore = new VectorStore(this.db);
      } else {
        this.embeddingProvider = null;
      }
    } catch {
      this.embeddingProvider = null;
      this.vectorStore = null;
    }
  }

  /**
   * VectorStore 인스턴스 (벡터 검색 불가 시 null)
   */
  public getVectorStore(): VectorStore | null {
    return this.vectorStore;
  }

  /**
   * EmbeddingProvider 인스턴스 (API 키 없으면 null)
   */
  public getEmbeddingProvider(): EmbeddingProvider | null {
    return this.embeddingProvider;
  }

  /**
   * 벡터 검색 사용 가능 여부
   */
  public isVectorAvailable(): boolean {
    return this.vectorStore !== null && this.embeddingProvider !== null;
  }

  /**
   * 비동기 임베딩 생성 + 벡터 저장 (실패 무시)
   */
  private embedAndStoreAsync(key: string, text: string): void {
    if (!this.embeddingProvider || !this.vectorStore) return;

    const provider = this.embeddingProvider;
    const store = this.vectorStore;

    void (async (): Promise<void> => {
      try {
        const result = await provider.embed([text]);
        if (result.embeddings.length > 0) {
          store.saveMemoryVector(key, result.embeddings[0]);
        }
      } catch {
        // 임베딩 실패 → 무시 (메모리 저장은 이미 성공)
      }
    })();
  }

  /**
   * Save or update a memory item
   */
  public save(key: string, value: string, category: string = 'general', priority: number = 0): void {
    const timestamp = new Date().toISOString();

    if (this.saveStmt) {
      this.saveStmt.run(key, value, category, timestamp, timestamp, priority);
    } else {
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
  public recall(key: string): MemoryItem | null {
    const timestamp = new Date().toISOString();

    if (this.recallStmt) {
      const result = this.recallStmt.get(timestamp, key) as MemoryItem | undefined;
      return result || null;
    }

    if (!this.recallSelectStmt || !this.recallUpdateStmt) {
      throw new Error('Fallback recall statements not initialized');
    }

    const result = this.recallSelectStmt.get(key) as MemoryItem | undefined;
    if (result) {
      this.recallUpdateStmt.run(timestamp, key);
    }

    return result || null;
  }

  /**
   * Delete a memory item
   */
  public delete(key: string): boolean {
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
  public update(key: string, value: string): boolean {
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
  public list(category?: string): MemoryItem[] {
    if (category) {
      const stmt = this.db.prepare(`
        SELECT * FROM memories WHERE category = ?
        ORDER BY priority DESC, timestamp DESC
      `);
      return stmt.all(category) as MemoryItem[];
    } else {
      const stmt = this.db.prepare(`
        SELECT * FROM memories
        ORDER BY priority DESC, timestamp DESC
      `);
      return stmt.all() as MemoryItem[];
    }
  }

  /**
   * Search memories by keyword (FTS5 priority, LIKE fallback)
   */
  public search(query: string): MemoryItem[] {
    if (this.fts5Available) {
      try {
        return this.searchFTS(query);
      } catch {
        // FTS5 query failed, fall through to LIKE
      }
    }
    return this.searchLike(query);
  }

  /**
   * Sanitize FTS5 query to prevent query syntax injection.
   * Removes special FTS5 operators and syntax characters.
   */
  public static sanitizeFTS5Query(query: string): string {
    const sanitized = query.replace(/["*(){}[\]^~:<>]/g, ' ').trim();
    if (!sanitized) return '""';
    return sanitized;
  }

  /**
   * Full-text search using FTS5 with bm25 ranking
   */
  public searchFTS(query: string, limit: number = 50): MemoryItem[] {
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

    return stmt.all(MemoryStorage.sanitizeFTS5Query(query), limit) as MemoryItem[];
  }

  /**
   * Check if FTS5 is available
   */
  public isFTS5Available(): boolean {
    return this.fts5Available;
  }

  private searchLike(query: string): MemoryItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE key LIKE ? OR value LIKE ?
      ORDER BY priority DESC, timestamp DESC
    `);

    const pattern = `%${query}%`;
    return stmt.all(pattern, pattern) as MemoryItem[];
  }

  /**
   * Get memories by priority level
   */
  public getByPriority(priority: number): MemoryItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories
      WHERE priority = ?
      ORDER BY timestamp DESC
    `);

    return stmt.all(priority) as MemoryItem[];
  }

  /**
   * Update priority of a memory item
   */
  public setPriority(key: string, priority: number): boolean {
    const stmt = this.db.prepare(`UPDATE memories SET priority = ? WHERE key = ?`);
    const result = stmt.run(priority, key);
    return result.changes > 0;
  }

  /**
   * Get memory statistics
   */
  public getStats(): { total: number; byCategory: Record<string, number> } {
    const categories = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM memories
      GROUP BY category
    `).all() as Array<{ category: string; count: number }>;

    const byCategory: Record<string, number> = {};
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
  public getTimeline(startDate?: string, endDate?: string, limit: number = 50): MemoryItem[] {
    let sql = `SELECT * FROM memories WHERE 1=1`;
    const params: (string | number)[] = [];

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

    return this.db.prepare(sql).all(...params) as MemoryItem[];
  }

  /**
   * Get database instance (for KnowledgeGraph)
   */
  public getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Get database path
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
