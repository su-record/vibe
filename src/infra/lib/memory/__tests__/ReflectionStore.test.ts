import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../MemoryStorage.js';
import { ReflectionStore, ReflectionInput } from '../ReflectionStore.js';

describe('ReflectionStore', () => {
  let storage: MemoryStorage;
  let store: ReflectionStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-refl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    store = new ReflectionStore(storage);
  });

  afterEach(() => {
    storage.close();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Cleanup failure is non-critical
    }
  });

  describe('Table creation', () => {
    it('should create reflections table without affecting existing tables', () => {
      const db = storage.getDatabase();

      // reflections table exists
      const reflTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='reflections'"
      ).get();
      expect(reflTable).toBeDefined();

      // memories table still exists
      const memTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memories'"
      ).get();
      expect(memTable).toBeDefined();

      // FTS5 table exists (if supported)
      if (storage.isFTS5Available()) {
        const ftsTable = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='reflections_fts'"
        ).get();
        expect(ftsTable).toBeDefined();
      }
    });
  });

  describe('save', () => {
    it('should save a minor reflection', () => {
      const id = store.save({
        type: 'minor',
        trigger: 'context_pressure',
        insights: ['Learned about SQLite WAL mode'],
        decisions: ['Use better-sqlite3'],
        patterns: [],
        score: 0.6,
        sessionId: 'session-1',
      });

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');

      const result = store.getById(id);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('minor');
      expect(result!.trigger).toBe('context_pressure');
      expect(result!.insights).toEqual(['Learned about SQLite WAL mode']);
      expect(result!.decisions).toEqual(['Use better-sqlite3']);
      expect(result!.score).toBe(0.6);
      expect(result!.sessionId).toBe('session-1');
    });

    it('should save a major reflection', () => {
      const id = store.save({
        type: 'major',
        trigger: 'session_end',
        insights: ['Completed login feature', 'Discovered performance issue'],
        decisions: ['Switch to JWT tokens'],
        patterns: ['N+1 query pattern in user listing'],
        filesContext: ['src/auth.ts', 'src/users.ts'],
        score: 0.9,
      });

      const result = store.getById(id);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('major');
      expect(result!.trigger).toBe('session_end');
      expect(result!.insights).toHaveLength(2);
      expect(result!.filesContext).toEqual(['src/auth.ts', 'src/users.ts']);
      expect(result!.score).toBe(0.9);
    });

    it('should save a manual reflection', () => {
      const id = store.save({
        type: 'minor',
        trigger: 'manual',
        insights: ['Manual note about architecture'],
        score: 0.7,
      });

      const result = store.getById(id);
      expect(result!.trigger).toBe('manual');
    });

    it('should clamp score to 0-1 range', () => {
      const id1 = store.save({ type: 'minor', trigger: 'manual', score: 1.5 });
      const id2 = store.save({ type: 'minor', trigger: 'manual', score: -0.5 });

      expect(store.getById(id1)!.score).toBe(1.0);
      expect(store.getById(id2)!.score).toBe(0);
    });

    it('should default score to 0.5 if not provided', () => {
      const id = store.save({ type: 'minor', trigger: 'manual' });
      expect(store.getById(id)!.score).toBe(0.5);
    });

    it('should sanitize invalid JSON arrays to empty arrays', () => {
      const id = store.save({
        type: 'minor',
        trigger: 'manual',
        insights: [123 as unknown as string, 'valid'],
        decisions: null as unknown as string[],
        patterns: undefined as unknown as string[],
      });

      const result = store.getById(id);
      expect(result!.insights).toEqual(['valid']);
      expect(result!.decisions).toEqual([]);
      expect(result!.patterns).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      store.save({
        type: 'minor',
        trigger: 'context_pressure',
        insights: ['auth pattern with JWT tokens'],
        score: 0.8,
      });
      store.save({
        type: 'major',
        trigger: 'session_end',
        decisions: ['Use React for frontend'],
        score: 0.6,
      });
      store.save({
        type: 'minor',
        trigger: 'manual',
        patterns: ['SQLite WAL mode for concurrency'],
        score: 0.9,
      });
    });

    it('should search reflections by keyword', () => {
      const results = store.search('auth');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].insights).toContain('auth pattern with JWT tokens');
    });

    it('should return empty array for no matches', () => {
      const results = store.search('nonexistent-keyword-xyz');
      expect(results).toEqual([]);
    });
  });

  describe('getBySession', () => {
    it('should get reflections for a specific session', () => {
      store.save({ type: 'minor', trigger: 'context_pressure', sessionId: 'session-A' });
      store.save({ type: 'major', trigger: 'session_end', sessionId: 'session-A' });
      store.save({ type: 'minor', trigger: 'manual', sessionId: 'session-B' });

      const results = store.getBySession('session-A');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.sessionId === 'session-A')).toBe(true);
    });
  });

  describe('getRecent', () => {
    it('should return most recent reflections', () => {
      store.save({ type: 'minor', trigger: 'manual', insights: ['first'] });
      store.save({ type: 'minor', trigger: 'manual', insights: ['second'] });
      store.save({ type: 'minor', trigger: 'manual', insights: ['third'] });

      const results = store.getRecent(2);
      expect(results).toHaveLength(2);
      // Most recent first
      expect(results[0].insights).toContain('third');
    });
  });

  describe('getHighValue', () => {
    it('should return high-value reflections above threshold', () => {
      store.save({ type: 'minor', trigger: 'manual', score: 0.3 });
      store.save({ type: 'minor', trigger: 'manual', score: 0.8 });
      store.save({ type: 'major', trigger: 'session_end', score: 0.9 });

      const results = store.getHighValue(0.7);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.score >= 0.7)).toBe(true);
      // Highest score first
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });
  });

  describe('getCount', () => {
    it('should return total reflection count', () => {
      expect(store.getCount()).toBe(0);
      store.save({ type: 'minor', trigger: 'manual' });
      store.save({ type: 'major', trigger: 'session_end' });
      expect(store.getCount()).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle reflection save failure gracefully when DB is closed', () => {
      storage.close();
      expect(() => {
        store.save({ type: 'minor', trigger: 'manual' });
      }).toThrow();
    });
  });
});
