// SQLite database connection and schema management
import Database from 'better-sqlite3';
import path from 'path';
import { getMemoryDir } from './memoryConfig.js';
import { existsSync, mkdirSync } from 'fs';
class MemoryDatabase {
    db = null;
    dbPath;
    constructor() {
        const memoryDir = getMemoryDir();
        // Ensure directory exists
        if (!existsSync(memoryDir)) {
            mkdirSync(memoryDir, { recursive: true });
        }
        this.dbPath = path.join(memoryDir, 'memories.db');
    }
    /**
     * Get database connection (lazy initialization)
     */
    getConnection() {
        if (!this.db) {
            // Ensure directory exists before opening database
            const memoryDir = getMemoryDir();
            if (!existsSync(memoryDir)) {
                mkdirSync(memoryDir, { recursive: true });
            }
            this.db = new Database(this.dbPath);
            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            // Initialize schema
            this.initSchema();
        }
        return this.db;
    }
    /**
     * Initialize database schema
     */
    initSchema() {
        const db = this.db;
        // Memories table
        db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        timestamp TEXT NOT NULL,
        lastAccessed TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_lastAccessed ON memories(lastAccessed);
    `);
        // Sessions table
        db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        contextType TEXT NOT NULL,
        summary TEXT NOT NULL,
        urgency TEXT NOT NULL,
        currentTask TEXT,
        codeChanges TEXT,
        decisions TEXT,
        blockers TEXT,
        nextSteps TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_sessionId ON sessions(sessionId);
      CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_urgency ON sessions(urgency);
    `);
        // Guides table (for coding guides)
        db.exec(`
      CREATE TABLE IF NOT EXISTS guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_guides_name ON guides(name);
      CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);
    `);
    }
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
    /**
     * Run a checkpoint to merge WAL file
     */
    checkpoint() {
        if (this.db) {
            this.db.pragma('wal_checkpoint(TRUNCATE)');
        }
    }
}
// Singleton instance
export const memoryDB = new MemoryDatabase();
// Cleanup on process exit
process.on('exit', () => {
    memoryDB.checkpoint();
    memoryDB.close();
});
process.on('SIGINT', () => {
    memoryDB.checkpoint();
    memoryDB.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    memoryDB.checkpoint();
    memoryDB.close();
    process.exit(0);
});
