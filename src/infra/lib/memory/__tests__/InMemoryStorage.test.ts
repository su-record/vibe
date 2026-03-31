import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '../InMemoryStorage.js';

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  describe('save + recall round trip', () => {
    it('saves and recalls a simple item', () => {
      storage.save('myKey', 'myValue');
      const item = storage.recall('myKey');
      expect(item).not.toBeNull();
      expect(item?.key).toBe('myKey');
      expect(item?.value).toBe('myValue');
      expect(item?.category).toBe('general');
      expect(item?.priority).toBe(0);
    });

    it('saves with custom category and priority', () => {
      storage.save('k', 'v', 'work', 5);
      const item = storage.recall('k');
      expect(item?.category).toBe('work');
      expect(item?.priority).toBe(5);
    });
  });

  describe('recall', () => {
    it('returns null for missing key', () => {
      expect(storage.recall('does-not-exist')).toBeNull();
    });

    it('updates lastAccessed on recall', () => {
      storage.save('k', 'v');
      const first = storage.recall('k');
      const second = storage.recall('k');
      expect(first?.lastAccessed).toBeDefined();
      expect(second?.lastAccessed).toBeDefined();
    });
  });

  describe('update', () => {
    it('returns true and updates value for existing key', () => {
      storage.save('k', 'old');
      const result = storage.update('k', 'new');
      expect(result).toBe(true);
      expect(storage.recall('k')?.value).toBe('new');
    });

    it('returns false for missing key', () => {
      expect(storage.update('missing', 'value')).toBe(false);
    });
  });

  describe('delete', () => {
    it('returns true and removes existing key', () => {
      storage.save('k', 'v');
      expect(storage.delete('k')).toBe(true);
      expect(storage.recall('k')).toBeNull();
    });

    it('returns false for missing key', () => {
      expect(storage.delete('missing')).toBe(false);
    });
  });

  describe('list', () => {
    it('returns all items when no category given', () => {
      storage.save('a', '1', 'catA');
      storage.save('b', '2', 'catB');
      expect(storage.list()).toHaveLength(2);
    });

    it('filters by category', () => {
      storage.save('a', '1', 'catA');
      storage.save('b', '2', 'catB');
      const result = storage.list('catA');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('a');
    });

    it('sorts by priority DESC then timestamp DESC', () => {
      storage.save('low', 'v', 'general', 1);
      storage.save('high', 'v', 'general', 10);
      const result = storage.list();
      expect(result[0].key).toBe('high');
      expect(result[1].key).toBe('low');
    });

    it('returns empty array when no items match category', () => {
      storage.save('a', '1', 'catA');
      expect(storage.list('catZ')).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('finds match in key', () => {
      storage.save('typescript-guide', 'some content');
      const results = storage.search('typescript');
      expect(results.some(i => i.key === 'typescript-guide')).toBe(true);
    });

    it('finds match in value', () => {
      storage.save('note', 'important refactoring needed');
      const results = storage.search('refactoring');
      expect(results.some(i => i.key === 'note')).toBe(true);
    });

    it('is case-insensitive', () => {
      storage.save('Hello', 'World');
      expect(storage.search('hello')).toHaveLength(1);
      expect(storage.search('WORLD')).toHaveLength(1);
    });

    it('returns empty array for no matches', () => {
      storage.save('foo', 'bar');
      expect(storage.search('zzz')).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('clears all data', () => {
      storage.save('a', '1');
      storage.save('b', '2');
      storage.close();
      expect(storage.list()).toHaveLength(0);
      expect(storage.recall('a')).toBeNull();
    });
  });
});
