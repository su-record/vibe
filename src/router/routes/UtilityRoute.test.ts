/**
 * UtilityRoute Tests
 * Translation, image gen, document gen, notes, file analysis routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { UtilityRoute } from './UtilityRoute.js';
import { SmartRouterLike, ClassifiedIntent, RouteContext, RouteJob, RouteServices } from '../types.js';
import { NoteService } from '../services/NoteService.js';

const mockLogger = vi.fn();

function createMockRouter(content: string = 'mock response'): SmartRouterLike {
  return {
    route: vi.fn().mockResolvedValue({ success: true, content }),
  } as unknown as SmartRouterLike;
}

function createContext(query: string): RouteContext {
  const mockRouterObj = {
    handleMessage: vi.fn(),
    getSmartRouter: vi.fn().mockReturnValue({
      route: vi.fn().mockResolvedValue({ content: 'ok', success: true }),
    }),
  };
  return {
    job: { id: 'job-1', status: 'executing', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RouteJob,
    intent: { category: 'utility', rawQuery: query, confidence: 0.9 } as ClassifiedIntent,
    message: { id: 'msg-1', channel: 'telegram', chatId: 'chat-1', userId: 'user-1', content: query, type: 'text', metadata: {}, timestamp: new Date().toISOString() },
    chatId: 'test-chat',
    userId: 'test-user',
    services: {
      logger: mockLogger,
      sendTelegram: vi.fn(),
      sendTelegramInlineKeyboard: vi.fn(),
      router: mockRouterObj,
      config: { repos: { aliases: {}, basePaths: [] }, qa: { autoApproveTools: [], maxWaitSeconds: 60, readOnTimeout: 'approve', writeOnTimeout: 'deny' }, notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 } },
    } as RouteServices,
  };
}

describe('UtilityRoute', () => {
  let route: UtilityRoute;
  let mockRouter: SmartRouterLike;
  let noteDbPath: string;
  let noteService: NoteService;

  beforeEach(() => {
    mockLogger.mockClear();
    mockRouter = createMockRouter();
    noteDbPath = path.join(os.tmpdir(), `vibe-note-rt-${Date.now()}`, 'notes.db');
    fs.mkdirSync(path.dirname(noteDbPath), { recursive: true });
    noteService = new NoteService(mockLogger, noteDbPath);
    route = new UtilityRoute(mockLogger, mockRouter, noteService);
  });

  afterEach(() => {
    noteService.close();
    try { fs.rmSync(path.dirname(noteDbPath), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('canHandle', () => {
    it('should handle utility category', () => {
      expect(route.canHandle({ category: 'utility', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(true);
    });

    it('should not handle other categories', () => {
      expect(route.canHandle({ category: 'development', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(false);
    });
  });

  describe('execute - translate', () => {
    it('should translate text', async () => {
      const result = await route.execute(createContext('번역해줘: Hello World'));
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('execute - image_generate', () => {
    it('should generate image from prompt', async () => {
      mockRouter = createMockRouter('이미지 설명: A beautiful sunset');
      route = new UtilityRoute(mockLogger, mockRouter, noteService);

      const result = await route.execute(createContext('이미지 생성 아름다운 일몰'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('이미지');
    });
  });

  describe('execute - document_write', () => {
    it('should generate a document', async () => {
      mockRouter = createMockRouter('# 프로젝트 보고서\n\n내용입니다.');
      route = new UtilityRoute(mockLogger, mockRouter, noteService);

      const result = await route.execute(createContext('문서 작성 프로젝트 보고서'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('프로젝트 보고서');
    });
  });

  describe('execute - note_save', () => {
    it('should save a note', async () => {
      const result = await route.execute(createContext('메모: 오늘 회의 내용'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('메모 저장됨');
    });
  });

  describe('execute - note_search', () => {
    it('should search saved notes', async () => {
      await noteService.save('TypeScript 학습 메모');
      const result = await route.execute(createContext('메모 검색 TypeScript'));
      expect(result.success).toBe(true);
    });

    it('should list all notes', async () => {
      await noteService.save('회의록 내용입니다');
      const result = await route.execute(createContext('메모 목록'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('회의록');
    });

    it('should return empty message when no notes', async () => {
      const result = await route.execute(createContext('메모 목록'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('없습니다');
    });
  });

  describe('execute - screenshot', () => {
    it('should require URL for screenshot', async () => {
      const result = await route.execute(createContext('스크린샷'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });
  });

  describe('execute - file_analyze', () => {
    it('should prompt for file attachment', async () => {
      const result = await route.execute(createContext('파일 분석'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('파일');
    });
  });
});
