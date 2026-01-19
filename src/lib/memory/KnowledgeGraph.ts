// Knowledge Graph operations for memory relationships
// Extracted from MemoryManager for better separation of concerns

import Database from 'better-sqlite3';
import { MemoryRelation, MemoryGraph, MemoryGraphNode } from '../../types/tool.js';
import { MemoryItem, MemoryStorage } from './MemoryStorage.js';

export class KnowledgeGraph {
  private db: Database.Database;
  private storage: MemoryStorage;

  constructor(storage: MemoryStorage) {
    this.storage = storage;
    this.db = storage.getDatabase();
  }

  /**
   * Link two memories with a relationship
   */
  public linkMemories(
    sourceKey: string,
    targetKey: string,
    relationType: string,
    strength: number = 1.0,
    metadata?: Record<string, unknown>
  ): boolean {
    const timestamp = new Date().toISOString();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memory_relations
        (sourceKey, targetKey, relationType, strength, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(sourceKey, targetKey, relationType, strength, metadataJson, timestamp);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all relations for a memory
   */
  public getRelations(key: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): MemoryRelation[] {
    let sql = '';

    if (direction === 'outgoing') {
      sql = `SELECT * FROM memory_relations WHERE sourceKey = ?`;
    } else if (direction === 'incoming') {
      sql = `SELECT * FROM memory_relations WHERE targetKey = ?`;
    } else {
      sql = `SELECT * FROM memory_relations WHERE sourceKey = ? OR targetKey = ?`;
    }

    const stmt = this.db.prepare(sql);
    const rows = direction === 'both'
      ? stmt.all(key, key) as Record<string, unknown>[]
      : stmt.all(key) as Record<string, unknown>[];

    return rows.map(row => ({
      sourceKey: row.sourceKey as string,
      targetKey: row.targetKey as string,
      relationType: row.relationType as string,
      strength: row.strength as number,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      timestamp: row.timestamp as string
    }));
  }

  /**
   * Get related memories using graph traversal
   */
  public getRelatedMemories(
    key: string,
    depth: number = 1,
    relationType?: string
  ): MemoryItem[] {
    const visited = new Set<string>([key]);
    const result: MemoryItem[] = [];
    let currentLevel = [key];

    for (let d = 0; d < depth; d++) {
      const nextLevel: string[] = [];

      for (const currentKey of currentLevel) {
        const relations = this.getRelations(currentKey, 'both');

        for (const rel of relations) {
          if (relationType && rel.relationType !== relationType) continue;

          const neighborKey = rel.sourceKey === currentKey ? rel.targetKey : rel.sourceKey;

          if (!visited.has(neighborKey)) {
            visited.add(neighborKey);
            nextLevel.push(neighborKey);

            const memory = this.storage.recall(neighborKey);
            if (memory) {
              result.push(memory);
            }
          }
        }
      }

      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }

    return result;
  }

  /**
   * Get memory graph structure
   */
  public getMemoryGraph(key?: string, depth: number = 2): MemoryGraph {
    const nodes: MemoryGraphNode[] = [];
    const edges: MemoryRelation[] = [];
    const visited = new Set<string>();

    if (key) {
      this.buildGraphFromKey(key, depth, visited, nodes, edges);
    } else {
      const allMemories = this.storage.list();
      for (const memory of allMemories) {
        const relations = this.getRelations(memory.key, 'outgoing');
        nodes.push({
          key: memory.key,
          value: memory.value,
          category: memory.category,
          relations
        });
        edges.push(...relations);
      }
    }

    const clusters = this.detectClusters(nodes, edges);

    return { nodes, edges, clusters };
  }

  private buildGraphFromKey(
    startKey: string,
    depth: number,
    visited: Set<string>,
    nodes: MemoryGraphNode[],
    edges: MemoryRelation[]
  ): void {
    const queue: Array<{ key: string; level: number }> = [{ key: startKey, level: 0 }];

    while (queue.length > 0) {
      const { key, level } = queue.shift()!;

      if (visited.has(key) || level > depth) continue;
      visited.add(key);

      const memory = this.storage.recall(key);
      if (!memory) continue;

      const relations = this.getRelations(key, 'both');
      nodes.push({
        key: memory.key,
        value: memory.value,
        category: memory.category,
        relations
      });

      for (const rel of relations) {
        if (!edges.some(e =>
          e.sourceKey === rel.sourceKey &&
          e.targetKey === rel.targetKey &&
          e.relationType === rel.relationType
        )) {
          edges.push(rel);
        }

        const neighborKey = rel.sourceKey === key ? rel.targetKey : rel.sourceKey;
        if (!visited.has(neighborKey) && level < depth) {
          queue.push({ key: neighborKey, level: level + 1 });
        }
      }
    }
  }

  private detectClusters(nodes: MemoryGraphNode[], edges: MemoryRelation[]): string[][] {
    const parent: Record<string, string> = {};

    for (const node of nodes) {
      parent[node.key] = node.key;
    }

    const find = (x: string): string => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };

    const union = (x: string, y: string) => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent[px] = py;
      }
    };

    for (const edge of edges) {
      if (parent[edge.sourceKey] !== undefined && parent[edge.targetKey] !== undefined) {
        union(edge.sourceKey, edge.targetKey);
      }
    }

    const clusters: Record<string, string[]> = {};
    for (const node of nodes) {
      const root = find(node.key);
      if (!clusters[root]) {
        clusters[root] = [];
      }
      clusters[root].push(node.key);
    }

    return Object.values(clusters).filter(c => c.length > 1);
  }

  /**
   * Find shortest path between two memories
   */
  public findPath(sourceKey: string, targetKey: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ key: string; path: string[] }> = [
      { key: sourceKey, path: [sourceKey] }
    ];

    while (queue.length > 0) {
      const { key, path } = queue.shift()!;

      if (key === targetKey) {
        return path;
      }

      if (visited.has(key)) continue;
      visited.add(key);

      const relations = this.getRelations(key, 'both');
      for (const rel of relations) {
        const neighborKey = rel.sourceKey === key ? rel.targetKey : rel.sourceKey;
        if (!visited.has(neighborKey)) {
          queue.push({ key: neighborKey, path: [...path, neighborKey] });
        }
      }
    }

    return null;
  }

  /**
   * Remove a relationship between memories
   */
  public unlinkMemories(sourceKey: string, targetKey: string, relationType?: string): boolean {
    let sql = `DELETE FROM memory_relations WHERE sourceKey = ? AND targetKey = ?`;
    const params: (string | number)[] = [sourceKey, targetKey];

    if (relationType) {
      sql += ` AND relationType = ?`;
      params.push(relationType);
    }

    const result = this.db.prepare(sql).run(...params);
    return result.changes > 0;
  }
}
