// Core memory storage operations (CRUD)
// Extracted from MemoryManager for better separation of concerns

import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, readFileSync, renameSync, existsSync } from 'fs';

export interface MemoryItem {
  key: string;
  value: string;
  category: string;
  timestamp: string;
  lastAccessed: string;
  priority?: number;
}

export class MemoryStorage {
  protected db: Database.Database;
  protected readonly dbPath: string;
  private recallStmt: Database.Statement | null = null;
  private saveStmt: Database.Statement | null = null;
  private recallSelectStmt: Database.Statement | null = null;
  private recallUpdateStmt: Database.Statement | null = null;

  constructor(projectPath: string) {
    // Normalize path
    const resolvedPath = path.resolve(projectPath);

    // Project-based memory: store in {projectPath}/.claude/vibe/memories/
    const memoryDir = path.join(resolvedPath, '.claude', 'vibe', 'memories');
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
    this.initializeDatabase();
    this.migrateFromJSON();
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

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Pre-compile frequently used statements
    this.initializePreparedStatements();
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
   * Search memories by keyword
   */
  public search(query: string): MemoryItem[] {
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
