// Advanced memory search operations
// Extracted from MemoryManager for better separation of concerns

import Database from 'better-sqlite3';
import { MemoryItem, MemoryStorage } from './MemoryStorage.js';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import type { VectorStore } from '../embedding/VectorStore.js';
import type { EmbeddingProvider } from '../embedding/EmbeddingProvider.js';

export type SearchStrategy = 'keyword' | 'fulltext' | 'graph_traversal' | 'temporal' | 'priority' | 'context_aware' | 'vector' | 'hybrid';

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
   * Advanced search with multiple strategies (sync — backward compatible)
   * vector/hybrid 전략은 context_aware로 fallback (동기)
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

      case 'fulltext':
        return this.searchFulltext(query, limit, category);

      case 'graph_traversal':
        if (!startKey) return this.searchKeyword(query, limit, category);
        return this.graph.getRelatedMemories(startKey, depth);

      case 'temporal':
        return this.searchTemporal(query, limit);

      case 'priority':
        return this.searchByPriority(query, limit);

      case 'context_aware':
        return this.searchContextAware(query, limit, category);

      case 'vector':
      case 'hybrid':
        // 동기 호출 시 context_aware fallback. 비동기는 searchAdvancedAsync 사용.
        return this.searchContextAware(query, limit, category);

      default:
        return this.storage.search(query);
    }
  }

  /**
   * Advanced search with vector support (async)
   * vector/hybrid 전략에서 실제 벡터 검색 수행
   */
  public async searchAdvancedAsync(
    query: string,
    strategy: SearchStrategy,
    options: SearchOptions = {}
  ): Promise<MemoryItem[]> {
    const { limit = 20, category } = options;

    switch (strategy) {
      case 'vector':
        return this.searchVector(query, limit);

      case 'hybrid':
        return this.searchHybrid(query, limit, category);

      default:
        return this.searchAdvanced(query, strategy, options);
    }
  }

  private searchKeyword(query: string, limit: number, category?: string): MemoryItem[] {
    return this.searchKeywordLike(query, limit, category);
  }

  private searchFulltext(query: string, limit: number, category?: string): MemoryItem[] {
    if (!this.storage.isFTS5Available()) {
      return this.searchKeywordLike(query, limit, category);
    }

    if (category) {
      const stmt = this.db.prepare(`
        SELECT m.*, bm25(memories_fts) as rank
        FROM memories_fts fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ? AND m.category = ?
        ORDER BY rank
        LIMIT ?
      `);
      return stmt.all(query, category, limit) as MemoryItem[];
    }

    return this.storage.searchFTS(query, limit);
  }

  private searchKeywordLike(query: string, limit: number, category?: string): MemoryItem[] {
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
    // Use FTS5 rank if available for better relevance scoring
    if (this.storage.isFTS5Available()) {
      try {
        let sql: string;
        const params: (string | number)[] = [];

        if (category) {
          sql = `
            SELECT m.*,
              (bm25(memories_fts) * -1 + m.priority * 0.5) as relevance_score
            FROM memories_fts fts
            JOIN memories m ON m.rowid = fts.rowid
            WHERE memories_fts MATCH ? AND m.category = ?
            ORDER BY relevance_score DESC, m.lastAccessed DESC
            LIMIT ?
          `;
          params.push(query, category, limit);
        } else {
          sql = `
            SELECT m.*,
              (bm25(memories_fts) * -1 + m.priority * 0.5) as relevance_score
            FROM memories_fts fts
            JOIN memories m ON m.rowid = fts.rowid
            WHERE memories_fts MATCH ?
            ORDER BY relevance_score DESC, m.lastAccessed DESC
            LIMIT ?
          `;
          params.push(query, limit);
        }

        const results = this.db.prepare(sql).all(...params) as MemoryItem[];
        if (results.length > 0) return results;
      } catch {
        // FTS5 query failed, fall through to LIKE-based scoring
      }
    }

    // LIKE-based fallback
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

  // ==========================================================================
  // Vector & Hybrid search
  // ==========================================================================

  /**
   * 순수 벡터 유사도 검색
   * 벡터 불가 시 BM25 fallback
   */
  private async searchVector(query: string, limit: number): Promise<MemoryItem[]> {
    const vectorStore = this.storage.getVectorStore();
    const provider = this.storage.getEmbeddingProvider();

    if (!vectorStore || !provider) {
      return this.storage.search(query);
    }

    try {
      const result = await provider.embed([query]);
      if (result.embeddings.length === 0) {
        return this.storage.search(query);
      }

      const vectorResults = vectorStore.searchMemoryVectors(
        result.embeddings[0],
        limit,
      );

      return this.resolveMemoryItems(
        vectorResults.map(v => v.key),
      );
    } catch {
      return this.storage.search(query);
    }
  }

  /**
   * 하이브리드 검색: Vector + BM25 + Priority
   * 벡터 불가 시 context_aware fallback
   */
  private async searchHybrid(
    query: string,
    limit: number,
    category?: string,
  ): Promise<MemoryItem[]> {
    const vectorStore = this.storage.getVectorStore();
    const provider = this.storage.getEmbeddingProvider();

    if (!vectorStore || !provider) {
      return this.searchContextAware(query, limit, category);
    }

    try {
      // 1. 벡터 검색
      const embResult = await provider.embed([query]);
      if (embResult.embeddings.length === 0) {
        return this.searchContextAware(query, limit, category);
      }

      const vectorResults = vectorStore.searchMemoryVectors(
        embResult.embeddings[0],
        limit * 3,
      );
      const vectorScores = new Map<string, number>();
      for (const v of vectorResults) {
        vectorScores.set(v.key, v.similarity);
      }

      // 2. BM25 검색
      const bm25Results = this.getBM25MemoryScores(query, limit * 3, category);

      // 3. 합집합 키 수집
      const allKeys = new Set([
        ...vectorScores.keys(),
        ...bm25Results.keys(),
      ]);

      // 4. 하이브리드 스코어 계산
      const scored: Array<{ key: string; score: number }> = [];
      for (const key of allKeys) {
        const vecScore = vectorScores.get(key) ?? 0;
        const bm25Score = bm25Results.get(key) ?? 0;
        const priorityScore = this.getMemoryPriority(key);

        const score =
          vecScore * 0.5 +
          bm25Score * 0.3 +
          priorityScore * 0.2;

        scored.push({ key, score });
      }

      // 5. 정렬 + limit
      scored.sort((a, b) => b.score - a.score);
      const topKeys = scored.slice(0, limit).map(s => s.key);

      return this.resolveMemoryItems(topKeys);
    } catch {
      return this.searchContextAware(query, limit, category);
    }
  }

  /**
   * BM25 스코어 맵 생성 (정규화: 0~1)
   */
  private getBM25MemoryScores(
    query: string,
    limit: number,
    category?: string,
  ): Map<string, number> {
    const scores = new Map<string, number>();

    if (!this.storage.isFTS5Available()) return scores;

    try {
      let sql: string;
      const params: (string | number)[] = [];

      if (category) {
        sql = `
          SELECT m.key, bm25(memories_fts) as rank
          FROM memories_fts fts
          JOIN memories m ON m.rowid = fts.rowid
          WHERE memories_fts MATCH ? AND m.category = ?
          ORDER BY rank
          LIMIT ?
        `;
        params.push(query, category, limit);
      } else {
        sql = `
          SELECT m.key, bm25(memories_fts) as rank
          FROM memories_fts fts
          JOIN memories m ON m.rowid = fts.rowid
          WHERE memories_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `;
        params.push(query, limit);
      }

      const rows = this.db.prepare(sql).all(...params) as Array<{
        key: string;
        rank: number;
      }>;

      for (const row of rows) {
        // BM25: negative (more negative = better). Normalize to 0~1.
        const clamped = Math.max(row.rank, -20);
        scores.set(row.key, Math.abs(clamped) / 20);
      }
    } catch {
      // FTS5 query failed
    }

    return scores;
  }

  /**
   * 메모리 priority 정규화 (0~1)
   */
  private getMemoryPriority(key: string): number {
    try {
      const row = this.db.prepare(
        'SELECT priority FROM memories WHERE key = ?',
      ).get(key) as { priority: number } | undefined;
      if (!row) return 0;
      return Math.min(row.priority / 2, 1);
    } catch {
      return 0;
    }
  }

  /**
   * 키 배열로 MemoryItem[] 조회 (순서 유지)
   */
  private resolveMemoryItems(keys: string[]): MemoryItem[] {
    if (keys.length === 0) return [];

    const placeholders = keys.map(() => '?').join(',');
    const rows = this.db.prepare(
      `SELECT * FROM memories WHERE key IN (${placeholders})`,
    ).all(...keys) as MemoryItem[];

    const rowMap = new Map(rows.map(r => [r.key, r]));
    return keys
      .map(k => rowMap.get(k))
      .filter((item): item is MemoryItem => item !== undefined);
  }
}
