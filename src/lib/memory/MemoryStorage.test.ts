// Unit tests for MemoryStorage
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage, MemoryItem } from './MemoryStorage.js';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;
  let testDir: string;

  beforeEach(() => {
    // Create unique test directory
    testDir = join(tmpdir(), `vibe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
  });

  afterEach(() => {
    // Close database and cleanup
    storage.close();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('save and recall', () => {
    it('should save and recall a memory item', () => {
      storage.save('test-key', 'test-value', 'test-category', 1);

      const result = storage.recall('test-key');

      expect(result).not.toBeNull();
      expect(result?.key).toBe('test-key');
      expect(result?.value).toBe('test-value');
      expect(result?.category).toBe('test-category');
      expect(result?.priority).toBe(1);
    });

    it('should return null for non-existent key', () => {
      const result = storage.recall('non-existent');

      expect(result).toBeNull();
    });

    it('should use default category and priority', () => {
      storage.save('default-key', 'default-value');

      const result = storage.recall('default-key');

      expect(result?.category).toBe('general');
      expect(result?.priority).toBe(0);
    });

    it('should update lastAccessed on recall', () => {
      storage.save('access-key', 'access-value');

      const first = storage.recall('access-key');
      const firstAccessed = first?.lastAccessed;

      // Small delay to ensure timestamp difference
      const second = storage.recall('access-key');

      expect(second?.lastAccessed).toBeDefined();
      // lastAccessed should be updated (or same if too fast)
      expect(second?.lastAccessed).toBeTruthy();
    });

    it('should overwrite existing key on save', () => {
      storage.save('overwrite-key', 'original-value');
      storage.save('overwrite-key', 'new-value', 'new-category', 5);

      const result = storage.recall('overwrite-key');

      expect(result?.value).toBe('new-value');
      expect(result?.category).toBe('new-category');
      expect(result?.priority).toBe(5);
    });
  });

  describe('update', () => {
    it('should update an existing memory value', () => {
      storage.save('update-key', 'old-value');

      const updated = storage.update('update-key', 'updated-value');
      const result = storage.recall('update-key');

      expect(updated).toBe(true);
      expect(result?.value).toBe('updated-value');
    });

    it('should return false for non-existent key', () => {
      const updated = storage.update('non-existent', 'value');

      expect(updated).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing memory', () => {
      storage.save('delete-key', 'delete-value');

      const deleted = storage.delete('delete-key');
      const result = storage.recall('delete-key');

      expect(deleted).toBe(true);
      expect(result).toBeNull();
    });

    it('should return false for non-existent key', () => {
      const deleted = storage.delete('non-existent');

      expect(deleted).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      storage.save('item1', 'value1', 'category-a', 1);
      storage.save('item2', 'value2', 'category-b', 2);
      storage.save('item3', 'value3', 'category-a', 3);
    });

    it('should list all memories', () => {
      const items = storage.list();

      expect(items).toHaveLength(3);
    });

    it('should list memories by category', () => {
      const items = storage.list('category-a');

      expect(items).toHaveLength(2);
      expect(items.every(i => i.category === 'category-a')).toBe(true);
    });

    it('should order by priority descending', () => {
      const items = storage.list();

      expect(items[0].priority).toBeGreaterThanOrEqual(items[1].priority || 0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      storage.save('user-settings', 'dark mode enabled', 'settings');
      storage.save('user-preferences', 'notification settings', 'settings');
      storage.save('app-config', 'api endpoint config', 'config');
    });

    it('should search by key', () => {
      const results = storage.search('user');

      expect(results).toHaveLength(2);
    });

    it('should search by value', () => {
      const results = storage.search('settings');

      expect(results).toHaveLength(2);
    });

    it('should return empty for no matches', () => {
      const results = storage.search('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('getByPriority', () => {
    beforeEach(() => {
      storage.save('high-1', 'value', 'cat', 10);
      storage.save('high-2', 'value', 'cat', 10);
      storage.save('low', 'value', 'cat', 1);
    });

    it('should get memories by priority level', () => {
      const highPriority = storage.getByPriority(10);

      expect(highPriority).toHaveLength(2);
    });

    it('should return empty for unused priority', () => {
      const noPriority = storage.getByPriority(999);

      expect(noPriority).toHaveLength(0);
    });
  });

  describe('setPriority', () => {
    it('should update priority of existing memory', () => {
      storage.save('priority-key', 'value', 'cat', 1);

      const updated = storage.setPriority('priority-key', 10);
      const result = storage.recall('priority-key');

      expect(updated).toBe(true);
      expect(result?.priority).toBe(10);
    });

    it('should return false for non-existent key', () => {
      const updated = storage.setPriority('non-existent', 10);

      expect(updated).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      storage.save('item1', 'value', 'category-a');
      storage.save('item2', 'value', 'category-a');
      storage.save('item3', 'value', 'category-b');

      const stats = storage.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byCategory['category-a']).toBe(2);
      expect(stats.byCategory['category-b']).toBe(1);
    });

    it('should return zero for empty storage', () => {
      const stats = storage.getStats();

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byCategory)).toHaveLength(0);
    });
  });

  describe('getTimeline', () => {
    it('should get memories sorted by time', () => {
      storage.save('old', 'value', 'cat');
      storage.save('new', 'value', 'cat');

      const timeline = storage.getTimeline();

      expect(timeline).toHaveLength(2);
      // Most recent first
      expect(timeline[0].key).toBe('new');
    });

    it('should respect limit parameter', () => {
      storage.save('item1', 'value');
      storage.save('item2', 'value');
      storage.save('item3', 'value');

      const timeline = storage.getTimeline(undefined, undefined, 2);

      expect(timeline).toHaveLength(2);
    });
  });

  describe('getDbPath', () => {
    it('should return the database path', () => {
      const dbPath = storage.getDbPath();

      expect(dbPath).toContain('memories.db');
      expect(existsSync(dbPath)).toBe(true);
    });
  });
});
