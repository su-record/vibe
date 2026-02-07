/**
 * BookmarkService Tests
 * SQLite CRUD + search operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { BookmarkService } from './BookmarkService.js';

const mockLogger = vi.fn();

function createTempDbPath(): string {
  const dir = path.join(os.tmpdir(), 'vibe-test-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'bookmarks-test.db');
}

describe('BookmarkService', () => {
  let service: BookmarkService;
  let dbPath: string;

  beforeEach(() => {
    mockLogger.mockClear();
    dbPath = createTempDbPath();
    service = new BookmarkService(mockLogger, dbPath);
  });

  afterEach(() => {
    service.close();
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('save', () => {
    it('should save a bookmark and return id', () => {
      const id = service.save('https://example.com', 'Example', 'Summary', ['tech', 'web']);
      expect(id).toBe(1);
      expect(service.count()).toBe(1);
    });
  });

  describe('list', () => {
    it('should list bookmarks in descending order', () => {
      service.save('https://a.com', 'A', 'Summary A', ['tag1']);
      service.save('https://b.com', 'B', 'Summary B', ['tag2']);

      const list = service.list();
      expect(list).toHaveLength(2);
      expect(list[0].title).toBe('B');
    });

    it('should filter by tag', () => {
      service.save('https://a.com', 'A', 'SA', ['tech']);
      service.save('https://b.com', 'B', 'SB', ['design']);

      const filtered = service.list('tech');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].url).toBe('https://a.com');
    });
  });

  describe('search', () => {
    it('should search by title, summary, and tags', () => {
      service.save('https://a.com', 'TypeScript Guide', 'Learn TS', ['typescript']);
      service.save('https://b.com', 'Python Guide', 'Learn Python', ['python']);

      const results = service.search('TypeScript');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('TypeScript Guide');
    });
  });

  describe('delete', () => {
    it('should delete an existing bookmark', () => {
      const id = service.save('https://a.com', 'A', 'SA', ['tag']);
      expect(service.delete(id)).toBe(true);
      expect(service.count()).toBe(0);
    });

    it('should return false for non-existent bookmark', () => {
      expect(service.delete(999)).toBe(false);
    });
  });

  describe('count', () => {
    it('should return correct bookmark count', () => {
      expect(service.count()).toBe(0);
      service.save('https://a.com', 'A', 'SA', []);
      service.save('https://b.com', 'B', 'SB', []);
      expect(service.count()).toBe(2);
    });
  });
});
