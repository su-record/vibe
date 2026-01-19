// Unit tests for KnowledgeGraph
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from './MemoryStorage.js';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('KnowledgeGraph', () => {
  let storage: MemoryStorage;
  let graph: KnowledgeGraph;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    graph = new KnowledgeGraph(storage);

    // Setup test data
    storage.save('node-a', 'Node A content', 'nodes');
    storage.save('node-b', 'Node B content', 'nodes');
    storage.save('node-c', 'Node C content', 'nodes');
    storage.save('node-d', 'Node D content', 'nodes');
  });

  afterEach(() => {
    storage.close();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('linkMemories', () => {
    it('should create a relationship between two memories', () => {
      const result = graph.linkMemories('node-a', 'node-b', 'related-to');

      expect(result).toBe(true);

      const relations = graph.getRelations('node-a', 'outgoing');
      expect(relations).toHaveLength(1);
      expect(relations[0].targetKey).toBe('node-b');
      expect(relations[0].relationType).toBe('related-to');
    });

    it('should set default strength to 1.0', () => {
      graph.linkMemories('node-a', 'node-b', 'related');

      const relations = graph.getRelations('node-a');
      expect(relations[0].strength).toBe(1.0);
    });

    it('should store custom strength', () => {
      graph.linkMemories('node-a', 'node-b', 'related', 0.5);

      const relations = graph.getRelations('node-a');
      expect(relations[0].strength).toBe(0.5);
    });

    it('should store metadata', () => {
      graph.linkMemories('node-a', 'node-b', 'related', 1.0, { reason: 'test' });

      const relations = graph.getRelations('node-a');
      expect(relations[0].metadata).toEqual({ reason: 'test' });
    });

    it('should update existing relationship on duplicate', () => {
      graph.linkMemories('node-a', 'node-b', 'related', 0.5);
      graph.linkMemories('node-a', 'node-b', 'related', 0.9);

      const relations = graph.getRelations('node-a');
      expect(relations).toHaveLength(1);
      expect(relations[0].strength).toBe(0.9);
    });
  });

  describe('getRelations', () => {
    beforeEach(() => {
      graph.linkMemories('node-a', 'node-b', 'outgoing');
      graph.linkMemories('node-c', 'node-a', 'incoming');
    });

    it('should get outgoing relations only', () => {
      const relations = graph.getRelations('node-a', 'outgoing');

      expect(relations).toHaveLength(1);
      expect(relations[0].targetKey).toBe('node-b');
    });

    it('should get incoming relations only', () => {
      const relations = graph.getRelations('node-a', 'incoming');

      expect(relations).toHaveLength(1);
      expect(relations[0].sourceKey).toBe('node-c');
    });

    it('should get both directions by default', () => {
      const relations = graph.getRelations('node-a', 'both');

      expect(relations).toHaveLength(2);
    });

    it('should return empty array for no relations', () => {
      const relations = graph.getRelations('node-d');

      expect(relations).toHaveLength(0);
    });
  });

  describe('getRelatedMemories', () => {
    beforeEach(() => {
      // Create chain: A -> B -> C
      graph.linkMemories('node-a', 'node-b', 'next');
      graph.linkMemories('node-b', 'node-c', 'next');
    });

    it('should get directly related memories (depth 1)', () => {
      const related = graph.getRelatedMemories('node-a', 1);

      expect(related).toHaveLength(1);
      expect(related[0].key).toBe('node-b');
    });

    it('should traverse multiple levels (depth 2)', () => {
      const related = graph.getRelatedMemories('node-a', 2);

      expect(related).toHaveLength(2);
      const keys = related.map(r => r.key);
      expect(keys).toContain('node-b');
      expect(keys).toContain('node-c');
    });

    it('should filter by relation type', () => {
      graph.linkMemories('node-a', 'node-d', 'different-type');

      const related = graph.getRelatedMemories('node-a', 1, 'next');

      expect(related).toHaveLength(1);
      expect(related[0].key).toBe('node-b');
    });

    it('should not include the starting node', () => {
      const related = graph.getRelatedMemories('node-a', 2);

      const keys = related.map(r => r.key);
      expect(keys).not.toContain('node-a');
    });
  });

  describe('getMemoryGraph', () => {
    beforeEach(() => {
      graph.linkMemories('node-a', 'node-b', 'related');
      graph.linkMemories('node-b', 'node-c', 'related');
    });

    it('should build graph from specific key', () => {
      const memoryGraph = graph.getMemoryGraph('node-a', 2);

      expect(memoryGraph.nodes.length).toBeGreaterThan(0);
      expect(memoryGraph.edges.length).toBeGreaterThan(0);
    });

    it('should build complete graph when no key specified', () => {
      const memoryGraph = graph.getMemoryGraph();

      expect(memoryGraph.nodes).toHaveLength(4); // All 4 nodes
    });

    it('should detect clusters', () => {
      // Create isolated cluster: C <-> D
      graph.linkMemories('node-c', 'node-d', 'cluster');
      graph.linkMemories('node-d', 'node-c', 'cluster');

      const memoryGraph = graph.getMemoryGraph();

      // Should have at least one cluster (connected components)
      expect(memoryGraph.clusters).toBeDefined();
    });
  });

  describe('findPath', () => {
    beforeEach(() => {
      // Create: A -> B -> C -> D
      graph.linkMemories('node-a', 'node-b', 'next');
      graph.linkMemories('node-b', 'node-c', 'next');
      graph.linkMemories('node-c', 'node-d', 'next');
    });

    it('should find direct path', () => {
      const path = graph.findPath('node-a', 'node-b');

      expect(path).toEqual(['node-a', 'node-b']);
    });

    it('should find multi-hop path', () => {
      const path = graph.findPath('node-a', 'node-d');

      expect(path).toEqual(['node-a', 'node-b', 'node-c', 'node-d']);
    });

    it('should return null for disconnected nodes', () => {
      storage.save('isolated', 'Isolated node', 'nodes');

      const path = graph.findPath('node-a', 'isolated');

      expect(path).toBeNull();
    });

    it('should return single-element path for same source and target', () => {
      const path = graph.findPath('node-a', 'node-a');

      expect(path).toEqual(['node-a']);
    });
  });

  describe('unlinkMemories', () => {
    beforeEach(() => {
      graph.linkMemories('node-a', 'node-b', 'type-1');
      graph.linkMemories('node-a', 'node-b', 'type-2');
    });

    it('should remove specific relation type', () => {
      const result = graph.unlinkMemories('node-a', 'node-b', 'type-1');

      expect(result).toBe(true);

      const relations = graph.getRelations('node-a');
      expect(relations).toHaveLength(1);
      expect(relations[0].relationType).toBe('type-2');
    });

    it('should remove all relations when type not specified', () => {
      const result = graph.unlinkMemories('node-a', 'node-b');

      expect(result).toBe(true);

      const relations = graph.getRelations('node-a');
      expect(relations).toHaveLength(0);
    });

    it('should return false for non-existent relation', () => {
      const result = graph.unlinkMemories('node-a', 'node-d');

      expect(result).toBe(false);
    });
  });
});
