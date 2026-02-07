/**
 * CompositeRoute Tests
 * DAG execution, history queries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeRoute } from './CompositeRoute.js';
import { SmartRouterLike, ClassifiedIntent, RouteContext, RouteJob, RouteServices } from '../types.js';

const mockLogger = vi.fn();

const VALID_DAG = JSON.stringify({
  description: 'Search and email',
  nodes: [
    { id: '1', type: 'research', action: 'web_search', dependsOn: [], params: {} },
    { id: '2', type: 'google', action: 'gmail_send', dependsOn: ['1'], params: {} },
  ],
});

function createMockRouter(): SmartRouterLike {
  return {
    route: vi.fn()
      .mockResolvedValueOnce({ success: true, content: VALID_DAG })
      .mockResolvedValue({ success: true, content: 'result data' }),
  } as unknown as SmartRouterLike;
}

function createContext(query: string): RouteContext {
  const mockRouterObj = {
    handleMessage: vi.fn(),
    getSmartRouter: vi.fn().mockReturnValue({ route: vi.fn().mockResolvedValue({ content: 'ok', success: true }) }),
  };
  return {
    job: { id: 'job-1', status: 'executing', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RouteJob,
    intent: { category: 'composite', rawQuery: query, confidence: 0.9 } as ClassifiedIntent,
    message: { id: 'msg-1', channel: 'telegram', chatId: 'chat-1', userId: 'user-1', content: query, type: 'text', metadata: {}, timestamp: new Date().toISOString() },
    chatId: 'chat-1',
    userId: 'user-1',
    services: {
      logger: mockLogger, sendTelegram: vi.fn(), sendTelegramInlineKeyboard: vi.fn(), registerCallbackHandler: vi.fn(), unregisterCallbackHandler: vi.fn(), router: mockRouterObj,
      config: { repos: { aliases: {}, basePaths: [] }, qa: { autoApproveTools: [], maxWaitSeconds: 60, readOnTimeout: 'approve', writeOnTimeout: 'deny' }, notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 } },
    } as RouteServices,
  };
}

describe('CompositeRoute', () => {
  let route: CompositeRoute;

  beforeEach(() => {
    mockLogger.mockClear();
    route = new CompositeRoute(mockLogger, createMockRouter());
  });

  describe('canHandle', () => {
    it('should handle composite category', () => {
      expect(route.canHandle({ category: 'composite', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(true);
    });

    it('should not handle other categories', () => {
      expect(route.canHandle({ category: 'monitor', rawQuery: '', confidence: 0.9 } as ClassifiedIntent)).toBe(false);
    });
  });

  describe('execute - composite task', () => {
    it('should plan and execute DAG', async () => {
      const ctx = createContext('검색해서 메일로 보내줘');
      const result = await route.execute(ctx);
      expect(result.data).toContain('복합 작업 결과');
      // Should have sent preview
      expect(ctx.services.sendTelegram).toHaveBeenCalled();
    });
  });

  describe('execute - history query', () => {
    it('should handle history query "어제 뭐 했지?"', async () => {
      const historyRouter = {
        route: vi.fn().mockResolvedValue({ success: true, content: '어제 3개의 커밋과 2개의 메모를 작성했습니다.' }),
      } as unknown as SmartRouterLike;
      route = new CompositeRoute(mockLogger, historyRouter);

      const result = await route.execute(createContext('어제 뭐 했지?'));
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle "오늘 한 일" query', async () => {
      const router = {
        route: vi.fn().mockResolvedValue({ success: true, content: '오늘 작업 요약' }),
      } as unknown as SmartRouterLike;
      route = new CompositeRoute(mockLogger, router);

      const result = await route.execute(createContext('오늘 뭐 했지?'));
      expect(result.success).toBe(true);
    });
  });
});
