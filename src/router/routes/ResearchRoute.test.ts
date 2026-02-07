/**
 * ResearchRoute Tests
 * Web search, summarization, bookmarks routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { ResearchRoute } from './ResearchRoute.js';
import { SmartRouterLike, ClassifiedIntent, RouteContext, RouteJob, RouteServices } from '../types.js';
import { BookmarkService } from '../services/BookmarkService.js';

const mockLogger = vi.fn();

function createMockRouter(content: string = 'mock result'): SmartRouterLike {
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
    intent: { category: 'research', rawQuery: query, confidence: 0.9 } as ClassifiedIntent,
    message: { id: 'msg-1', channel: 'telegram', chatId: 'chat-1', userId: 'user-1', content: query, type: 'text', metadata: {}, timestamp: new Date().toISOString() },
    chatId: 'test-chat',
    userId: 'test-user',
    services: {
      logger: mockLogger,
      sendTelegram: vi.fn(),
      sendTelegramInlineKeyboard: vi.fn(),
      registerCallbackHandler: vi.fn(),
      unregisterCallbackHandler: vi.fn(),
      router: mockRouterObj,
      config: { repos: { aliases: {}, basePaths: [] }, qa: { autoApproveTools: [], maxWaitSeconds: 60, readOnTimeout: 'approve', writeOnTimeout: 'deny' }, notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 } },
    } as RouteServices,
  };
}

describe('ResearchRoute', () => {
  let route: ResearchRoute;
  let mockRouter: SmartRouterLike;
  let bookmarkDbPath: string;
  let bookmarkService: BookmarkService;

  beforeEach(() => {
    mockLogger.mockClear();
    const searchResults = JSON.stringify([
      { title: 'Result', url: 'https://example.com', snippet: 'A result' },
    ]);
    mockRouter = createMockRouter(searchResults);
    bookmarkDbPath = path.join(os.tmpdir(), `vibe-bm-test-${Date.now()}`, 'bm.db');
    fs.mkdirSync(path.dirname(bookmarkDbPath), { recursive: true });
    bookmarkService = new BookmarkService(mockLogger, bookmarkDbPath);
    route = new ResearchRoute(mockLogger, mockRouter, bookmarkService);
  });

  afterEach(() => {
    bookmarkService.close();
    try { fs.rmSync(path.dirname(bookmarkDbPath), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('canHandle', () => {
    it('should handle research category', () => {
      expect(route.canHandle({ category: 'research', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(true);
    });

    it('should not handle other categories', () => {
      expect(route.canHandle({ category: 'development', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should handle web search queries', async () => {
      const result = await route.execute(createContext('검색 TypeScript 가이드'));
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle summarize with URL', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><title>Page</title><body>Content</body></html>'),
      }));

      const routeFn = vi.fn()
        .mockResolvedValue({ success: true, content: '요약 결과' });
      mockRouter = { route: routeFn } as unknown as SmartRouterLike;
      route = new ResearchRoute(mockLogger, mockRouter, bookmarkService);

      const result = await route.execute(createContext('요약 https://example.com'));
      expect(result.success).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should handle bookmark list', async () => {
      bookmarkService.save('https://a.com', 'A', 'SA', ['tag']);
      const result = await route.execute(createContext('북마크 목록'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('A');
    });

    it('should return empty message for empty bookmark list', async () => {
      const result = await route.execute(createContext('북마크 목록'));
      expect(result.success).toBe(true);
      expect(result.data).toContain('없습니다');
    });
  });
});
