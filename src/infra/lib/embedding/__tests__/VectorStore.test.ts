import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { VectorStore } from '../VectorStore.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('VectorStore', () => {
  let db: Database.Database;
  let store: VectorStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `vector-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    db = new Database(join(testDir, 'test.db'));
    db.pragma('journal_mode = WAL');
    store = new VectorStore(db);
  });

  afterEach(() => {
    db.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('memory vectors', () => {
    it('should save and count memory vectors', () => {
      store.saveMemoryVector('key1', [0.1, 0.2, 0.3]);
      store.saveMemoryVector('key2', [0.4, 0.5, 0.6]);

      expect(store.getMemoryVectorCount()).toBe(2);
    });

    it('should upsert memory vector on same key', () => {
      store.saveMemoryVector('key1', [0.1, 0.2, 0.3]);
      store.saveMemoryVector('key1', [0.7, 0.8, 0.9]);

      expect(store.getMemoryVectorCount()).toBe(1);
    });

    it('should delete memory vector', () => {
      store.saveMemoryVector('key1', [0.1, 0.2, 0.3]);
      store.deleteMemoryVector('key1');

      expect(store.getMemoryVectorCount()).toBe(0);
    });

    it('should search memory vectors by cosine similarity', () => {
      store.saveMemoryVector('similar', [1.0, 0.0, 0.0]);
      store.saveMemoryVector('different', [0.0, 1.0, 0.0]);
      store.saveMemoryVector('orthogonal', [0.0, 0.0, 1.0]);

      const results = store.searchMemoryVectors([1.0, 0.0, 0.0], 3);

      expect(results.length).toBe(3);
      expect(results[0].key).toBe('similar');
      expect(results[0].similarity).toBeCloseTo(1.0, 4);
      expect(results[1].similarity).toBeCloseTo(0.0, 4);
    });

    it('should respect search limit', () => {
      store.saveMemoryVector('a', [1.0, 0.0]);
      store.saveMemoryVector('b', [0.9, 0.1]);
      store.saveMemoryVector('c', [0.0, 1.0]);

      const results = store.searchMemoryVectors([1.0, 0.0], 2);
      expect(results.length).toBe(2);
    });

    it('should return empty for no vectors', () => {
      const results = store.searchMemoryVectors([1.0, 0.0], 5);
      expect(results).toHaveLength(0);
    });
  });

  describe('session vectors', () => {
    it('should save and count session vectors', () => {
      store.saveSessionVector('decisions', 1, [0.1, 0.2]);
      store.saveSessionVector('decisions', 2, [0.3, 0.4]);
      store.saveSessionVector('goals', 1, [0.5, 0.6]);

      expect(store.getSessionVectorCount('decisions')).toBe(2);
      expect(store.getSessionVectorCount('goals')).toBe(1);
      expect(store.getSessionVectorCount()).toBe(3);
    });

    it('should search session vectors by entity type', () => {
      store.saveSessionVector('decisions', 1, [1.0, 0.0]);
      store.saveSessionVector('decisions', 2, [0.0, 1.0]);
      store.saveSessionVector('goals', 1, [1.0, 0.0]); // same vector but different type

      const results = store.searchSessionVectors('decisions', [1.0, 0.0], 5);

      expect(results.length).toBe(2);
      expect(results[0].entityType).toBe('decisions');
      expect(results[0].entityId).toBe(1);
      expect(results[0].similarity).toBeCloseTo(1.0, 4);
    });

    it('should delete session vector', () => {
      store.saveSessionVector('goals', 1, [0.1, 0.2]);
      store.deleteSessionVector('goals', 1);

      expect(store.getSessionVectorCount('goals')).toBe(0);
    });

    it('should upsert session vector on same type+id', () => {
      store.saveSessionVector('goals', 1, [0.1, 0.2]);
      store.saveSessionVector('goals', 1, [0.3, 0.4]);

      expect(store.getSessionVectorCount('goals')).toBe(1);
    });
  });
});
