// Advanced memory search operations
// Extracted from MemoryManager for better separation of concerns

import Database from 'better-sqlite3';
import { MemoryItem, MemoryStorage } from './MemoryStorage.js';
import { KnowledgeGraph } from './KnowledgeGraph.js';

export type SearchStrategy = 'keyword' | 'graph_traversal' | 'temporal' | 'priority' | 'context_aware';

export interface SearchOptions {
  limit?: number;
  category?: string;
  includeRelations?: boolean;
  startKey?: string;
  depth?: number;
}

export class MemorySearch {
  private db: Database.Database;
  private storage: MemoryStorage;
  private graph: KnowledgeGraph;

  constructor(storage: MemoryStorage, graph: KnowledgeGraph) {
    this.storage = storage;
    this.graph = graph;
    this.db = storage.getDatabase();
  }

  /**
   * Advanced search with multiple strategies
   */
  public searchAdvanced(
    query: string,
    strategy: SearchStrategy,
    options: SearchOptions = {}
  ): MemoryItem[] {
    const { limit = 20, category, startKey, depth = 2 } = options;

    switch (strategy) {
      case 'keyword':
        return this.searchKeyword(query, limit, category);

      case 'graph_traversal':
        if (!startKey) return this.searchKeyword(query, limit, category);
        return this.graph.getRelatedMemories(startKey, depth);

      case 'temporal':
        return this.searchTemporal(query, limit);

      case 'priority':
        return this.searchByPriority(query, limit);

      case 'context_aware':
        return this.searchContextAware(query, limit, category);

      default:
        return this.storage.search(query);
    }
  }

  private searchKeyword(query: string, limit: number, category?: string): MemoryItem[] {
    let sql = `
      SELECT * FROM memories
      WHERE (key LIKE ? OR value LIKE ?)
    `;
    const params: (string | number)[] = [`%${query}%`, `%${query}%`];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY priority DESC, timestamp DESC LIMIT ?`;
    params.push(limit);

    return this.db.prepare(sql).all(...params) as MemoryItem[];
  }

  private searchTemporal(query: string, limit: number): MemoryItem[] {
    const sql = `
      SELECT * FROM memories
      WHERE key LIKE ? OR value LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    return this.db.prepare(sql).all(`%${query}%`, `%${query}%`, limit) as MemoryItem[];
  }

  private searchByPriority(query: string, limit: number): MemoryItem[] {
    const sql = `
      SELECT * FROM memories
      WHERE key LIKE ? OR value LIKE ?
      ORDER BY priority DESC, lastAccessed DESC
      LIMIT ?
    `;
    return this.db.prepare(sql).all(`%${query}%`, `%${query}%`, limit) as MemoryItem[];
  }

  private searchContextAware(query: string, limit: number, category?: string): MemoryItem[] {
    let sql = `
      SELECT *,
        (CASE WHEN key LIKE ? THEN 3 ELSE 0 END +
         CASE WHEN value LIKE ? THEN 2 ELSE 0 END +
         priority * 0.5) as relevance_score
      FROM memories
      WHERE key LIKE ? OR value LIKE ?
    `;
    const params: (string | number)[] = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY relevance_score DESC, lastAccessed DESC LIMIT ?`;
    params.push(limit);

    return this.db.prepare(sql).all(...params) as MemoryItem[];
  }
}
