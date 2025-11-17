// SQLite-based memory operations
import { memoryDB } from './database.js';
/**
 * Save or update memory
 */
export function saveMemory(key, value, category = 'general') {
    const db = memoryDB.getConnection();
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT INTO memories (key, value, category, timestamp, lastAccessed)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      category = excluded.category,
      timestamp = excluded.timestamp,
      lastAccessed = excluded.lastAccessed
  `);
    stmt.run(key, value, category, timestamp, timestamp);
}
/**
 * Get memory by key
 */
export function getMemory(key) {
    const db = memoryDB.getConnection();
    const stmt = db.prepare('SELECT * FROM memories WHERE key = ?');
    const memory = stmt.get(key);
    // Update last accessed time
    if (memory) {
        const updateStmt = db.prepare('UPDATE memories SET lastAccessed = ? WHERE key = ?');
        updateStmt.run(new Date().toISOString(), key);
    }
    return memory;
}
/**
 * List memories with optional filtering
 */
export function listMemories(options) {
    const db = memoryDB.getConnection();
    const { category, limit = 10, offset = 0 } = options;
    let whereClause = '';
    const params = [];
    if (category) {
        whereClause = 'WHERE category = ?';
        params.push(category);
    }
    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM memories ${whereClause}`);
    const { count } = countStmt.get(...params);
    // Get paginated results
    const stmt = db.prepare(`
    SELECT * FROM memories ${whereClause}
    ORDER BY lastAccessed DESC
    LIMIT ? OFFSET ?
  `);
    const memories = stmt.all(...params, limit, offset);
    return { memories, total: count };
}
/**
 * Search memories by content
 */
export function searchMemories(query, options) {
    const db = memoryDB.getConnection();
    const { category, limit = 20 } = options || {};
    let whereClause = 'WHERE (key LIKE ? OR value LIKE ?)';
    const params = [`%${query}%`, `%${query}%`];
    if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
    }
    const stmt = db.prepare(`
    SELECT * FROM memories ${whereClause}
    ORDER BY lastAccessed DESC
    LIMIT ?
  `);
    return stmt.all(...params, limit);
}
/**
 * Delete memory by key
 */
export function deleteMemory(key) {
    const db = memoryDB.getConnection();
    const stmt = db.prepare('DELETE FROM memories WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
}
/**
 * Update memory
 */
export function updateMemory(key, value, append = false) {
    const db = memoryDB.getConnection();
    if (append) {
        const existing = getMemory(key);
        if (existing) {
            value = existing.value + '\n' + value;
        }
    }
    const stmt = db.prepare(`
    UPDATE memories
    SET value = ?, lastAccessed = ?
    WHERE key = ?
  `);
    const result = stmt.run(value, new Date().toISOString(), key);
    return result.changes > 0;
}
/**
 * Get memory statistics
 */
export function getMemoryStats() {
    const db = memoryDB.getConnection();
    // Total count
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM memories');
    const { count: totalMemories } = totalStmt.get();
    // By category
    const categoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM memories
    GROUP BY category
  `);
    const categoryResults = categoryStmt.all();
    const byCategory = Object.fromEntries(categoryResults.map(r => [r.category, r.count]));
    // Recently accessed
    const recentStmt = db.prepare(`
    SELECT * FROM memories
    ORDER BY lastAccessed DESC
    LIMIT 10
  `);
    const recentlyAccessed = recentStmt.all();
    return { totalMemories, byCategory, recentlyAccessed };
}
/**
 * Clear all memories (use with caution!)
 */
export function clearAllMemories() {
    const db = memoryDB.getConnection();
    const stmt = db.prepare('DELETE FROM memories');
    const result = stmt.run();
    return result.changes;
}
