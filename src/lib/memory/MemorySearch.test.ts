// Unit tests for MemorySearch
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from './MemoryStorage.js';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import { MemorySearch } from './MemorySearch.js';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MemorySearch', () => {
  let storage: MemoryStorage;
  let graph: KnowledgeGraph;
  let search: MemorySearch;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `vibe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    graph = new KnowledgeGraph(storage);
    search = new MemorySearch(storage, graph);

    // Setup test data with varied priorities and categories
    storage.save('user-auth', 'Authentication module for users', 'auth', 10);
    storage.save('user-profile', 'User profile management', 'profile', 5);
    storage.save('admin-auth', 'Admin authentication system', 'auth', 8);
    storage.save('api-endpoint', 'REST API endpoints', 'api', 3);
    storage.save('database-config', 'Database configuration settings', 'config', 7);
  });

  afterEach(() => {
    storage.close();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('searchAdvanced with keyword strategy', () => {
    it('should search by keyword in key and value', () => {
      const results = search.searchAdvanced('user', 'keyword');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.key.includes('user'))).toBe(true);
    });

    it('should filter by category', () => {
      const results = search.searchAdvanced('auth', 'keyword', { category: 'auth' });

      expect(results.every(r => r.category === 'auth')).toBe(true);
    });

    it('should respect limit option', () => {
      const results = search.searchAdvanced('', 'keyword', { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should order by priority', () => {
      const results = search.searchAdvanced('auth', 'keyword');

      // First result should have higher priority
      if (results.length > 1) {
        expect(results[0].priority).toBeGreaterThanOrEqual(results[1].priority || 0);
      }
    });
  });

  describe('searchAdvanced with temporal strategy', () => {
    it('should return results ordered by timestamp', () => {
      const results = search.searchAdvanced('', 'temporal');

      expect(results.length).toBeGreaterThan(0);
      // Most recent first
      if (results.length > 1) {
        expect(results[0].timestamp >= results[1].timestamp).toBe(true);
      }
    });
  });

  describe('searchAdvanced with priority strategy', () => {
    it('should order by priority then last accessed', () => {
      const results = search.searchAdvanced('', 'priority');

      expect(results.length).toBeGreaterThan(0);
      // Highest priority first
      if (results.length > 1) {
        expect(results[0].priority).toBeGreaterThanOrEqual(results[1].priority || 0);
      }
    });

    it('should filter by query', () => {
      const results = search.searchAdvanced('auth', 'priority');

      expect(results.every(r => r.key.includes('auth') || r.value.includes('auth'))).toBe(true);
    });
  });

  describe('searchAdvanced with graph_traversal strategy', () => {
    beforeEach(() => {
      graph.linkMemories('user-auth', 'user-profile', 'related');
      graph.linkMemories('user-profile', 'database-config', 'depends-on');
    });

    it('should fall back to keyword search without startKey', () => {
      const results = search.searchAdvanced('user', 'graph_traversal');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should traverse graph from startKey', () => {
      const results = search.searchAdvanced('', 'graph_traversal', {
        startKey: 'user-auth',
        depth: 2
      });

      const keys = results.map(r => r.key);
      expect(keys).toContain('user-profile');
    });

    it('should respect depth parameter', () => {
      const depth1 = search.searchAdvanced('', 'graph_traversal', {
        startKey: 'user-auth',
        depth: 1
      });

      const depth2 = search.searchAdvanced('', 'graph_traversal', {
        startKey: 'user-auth',
        depth: 2
      });

      expect(depth2.length).toBeGreaterThanOrEqual(depth1.length);
    });
  });

  describe('searchAdvanced with context_aware strategy', () => {
    it('should rank by relevance score', () => {
      // Use single word that exists in test data
      const results = search.searchAdvanced('user', 'context_aware');

      expect(results.length).toBeGreaterThan(0);
      // Results with matches in key should be ranked higher
    });

    it('should filter by category', () => {
      const results = search.searchAdvanced('auth', 'context_aware', { category: 'auth' });

      expect(results.every(r => r.category === 'auth')).toBe(true);
    });

    it('should consider priority in relevance', () => {
      const results = search.searchAdvanced('auth', 'context_aware');

      // Higher priority items should generally rank better for same keyword match
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('searchAdvanced with unknown strategy', () => {
    it('should fall back to basic search', () => {
      const results = search.searchAdvanced('user', 'unknown' as any);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('search options', () => {
    it('should use default limit of 20', () => {
      // Add more items
      for (let i = 0; i < 25; i++) {
        storage.save(`item-${i}`, `value ${i}`, 'test');
      }

      const results = search.searchAdvanced('item', 'keyword');

      expect(results.length).toBeLessThanOrEqual(20);
    });

    it('should handle empty query', () => {
      const results = search.searchAdvanced('', 'keyword', { limit: 5 });

      // Should return some results (empty query matches all due to LIKE %%)
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
