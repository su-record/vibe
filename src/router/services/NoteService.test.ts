/**
 * NoteService Tests
 * SQLite CRUD + LLM auto-classification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { NoteService } from './NoteService.js';
import { SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createTempDbPath(): string {
  const dir = path.join(os.tmpdir(), 'vibe-note-test-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'notes-test.db');
}

describe('NoteService', () => {
  let service: NoteService;
  let dbPath: string;

  beforeEach(() => {
    mockLogger.mockClear();
    dbPath = createTempDbPath();
  });

  afterEach(() => {
    service.close();
    try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('without SmartRouter (no auto-classify)', () => {
    beforeEach(() => {
      service = new NoteService(mockLogger, dbPath);
    });

    it('should save a note with general category', async () => {
      const note = await service.save('회의 메모 내용');
      expect(note.id).toBe(1);
      expect(note.content).toBe('회의 메모 내용');
      expect(note.category).toBe('general');
      expect(note.tags).toBe('');
    });

    it('should list notes in descending order', async () => {
      await service.save('Note 1');
      await service.save('Note 2');
      const list = service.list();
      expect(list).toHaveLength(2);
      expect(list[0].content).toBe('Note 2');
    });

    it('should search notes by content', async () => {
      await service.save('TypeScript 관련 메모');
      await service.save('Python 관련 메모');
      const results = service.search('TypeScript');
      expect(results).toHaveLength(1);
    });

    it('should delete a note', async () => {
      const note = await service.save('삭제할 메모');
      expect(service.delete(note.id)).toBe(true);
      expect(service.list()).toHaveLength(0);
    });

    it('should filter by category', async () => {
      await service.save('Work note');
      const list = service.list('general');
      expect(list).toHaveLength(1);
      expect(service.list('work')).toHaveLength(0);
    });
  });

  describe('with SmartRouter (auto-classify)', () => {
    it('should auto-classify with LLM tags and category', async () => {
      const mockRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({
          success: true,
          content: '{"tags": ["회의", "기획"], "category": "meeting"}',
        }),
      } as unknown as SmartRouterLike;

      service = new NoteService(mockLogger, dbPath, mockRouter);
      const note = await service.save('기획 회의 내용 정리');
      expect(note.tags).toBe('회의,기획');
      expect(note.category).toBe('meeting');
    });

    it('should fallback to general on LLM failure', async () => {
      const mockRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({ success: false, content: '' }),
      } as unknown as SmartRouterLike;

      service = new NoteService(mockLogger, dbPath, mockRouter);
      const note = await service.save('테스트 메모');
      expect(note.category).toBe('general');
      expect(note.tags).toBe('');
    });
  });
});
