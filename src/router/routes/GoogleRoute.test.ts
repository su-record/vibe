/**
 * GoogleRoute Tests
 * Sub-intent classification, auth check, service delegation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleRoute } from './GoogleRoute.js';
import { GoogleAuthManager } from '../services/GoogleAuthManager.js';
import { ClassifiedIntent, RouteContext, RouteJob, RouteServices, SmartRouterLike } from '../types.js';

const mockLogger = vi.fn();

function createMockAuth(authenticated: boolean = true): GoogleAuthManager {
  return {
    fetchApi: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    getAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/authorize?test=1'),
  } as unknown as GoogleAuthManager;
}

function createContext(content: string): RouteContext {
  const mockRouter = {
    handleMessage: vi.fn(),
    getSmartRouter: vi.fn().mockReturnValue({
      route: vi.fn().mockResolvedValue({ content: 'ok', success: true }),
    }),
  };

  return {
    job: {
      id: 'job-1',
      status: 'executing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as RouteJob,
    intent: {
      category: 'google',
      confidence: 0.9,
      rawQuery: content,
    } as ClassifiedIntent,
    message: {
      id: 'msg-1',
      channel: 'telegram',
      chatId: 'chat-1',
      userId: 'user-1',
      content,
      type: 'text',
      metadata: {},
      timestamp: new Date().toISOString(),
    },
    chatId: 'chat-1',
    userId: 'user-1',
    services: {
      logger: mockLogger,
      sendTelegram: vi.fn(),
      sendTelegramInlineKeyboard: vi.fn(),
      router: mockRouter,
      config: {
        repos: { aliases: {}, basePaths: [] },
        qa: { autoApproveTools: [], maxWaitSeconds: 60, readOnTimeout: 'approve', writeOnTimeout: 'deny' },
        notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 },
      },
    } as RouteServices,
  };
}

describe('GoogleRoute', () => {
  describe('canHandle', () => {
    it('should handle google category', () => {
      const route = new GoogleRoute(mockLogger, createMockAuth());
      const intent: ClassifiedIntent = {
        category: 'google',
        confidence: 0.9,
        rawQuery: 'test',
      };
      expect(route.canHandle(intent)).toBe(true);
    });

    it('should not handle other categories', () => {
      const route = new GoogleRoute(mockLogger, createMockAuth());
      const intent: ClassifiedIntent = {
        category: 'development',
        confidence: 0.9,
        rawQuery: 'test',
      };
      expect(route.canHandle(intent)).toBe(false);
    });
  });

  describe('Authentication check', () => {
    it('should start auth flow and send URL when not authenticated', async () => {
      const mockAuth = createMockAuth(false);
      mockAuth.startAuthFlow = vi.fn().mockRejectedValue(new Error('OAuth 인증 타임아웃 (5분)'));
      const route = new GoogleRoute(mockLogger, mockAuth);
      const context = createContext('메일 보내줘');

      const result = await route.execute(context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Google 인증 실패');
      expect(context.services.sendTelegram).toHaveBeenCalledWith(
        context.chatId,
        expect.stringContaining('accounts.google.com'),
      );
    });
  });

  describe('Gmail sub-intent routing', () => {
    it('should route "메일 검색" to gmail_search', async () => {
      const mockAuth = createMockAuth();
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ messages: null }), { status: 200 }),
      );

      const route = new GoogleRoute(mockLogger, mockAuth);
      const context = createContext('John이 보낸 메일 검색해줘');

      const result = await route.execute(context);
      // Should call Gmail API (even if empty results)
      expect(result.success).toBe(true);
      expect(result.data).toContain('검색 결과가 없습니다');
    });

    it('should route "메일 보내" to gmail_send', async () => {
      const mockAuth = createMockAuth();
      const route = new GoogleRoute(mockLogger, mockAuth);
      const context = createContext('test@email.com에 메일 보내줘 제목: 안녕');

      const result = await route.execute(context);
      // Should attempt to send (may fail without real API)
      expect(mockAuth.fetchApi).toHaveBeenCalled();
    });
  });

  describe('YouTube sub-intent routing', () => {
    it('should route "유튜브 검색" to youtube_search', async () => {
      const mockAuth = createMockAuth();
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

      const route = new GoogleRoute(mockLogger, mockAuth);
      const context = createContext('유튜브 검색 AI 뉴스');

      const result = await route.execute(context);
      expect(result.success).toBe(true);
      expect(result.data).toContain('검색 결과가 없습니다');
    });

    it('should extract videoId for youtube_summarize', async () => {
      const mockAuth = createMockAuth();
      const mockSmartRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({ content: '비디오 요약입니다.', success: true }),
      };

      const route = new GoogleRoute(mockLogger, mockAuth, mockSmartRouter);

      // Mock caption list + download + video info
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{ id: 'cap-1', snippet: { language: 'ko', trackKind: 'standard', name: '' } }],
          }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response('1\n00:00:01,000 --> 00:00:05,000\n테스트\n\n', { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{
              id: 'dQw4w9WgXcQ',
              snippet: { title: 'Test', description: '', channelTitle: 'CH', publishedAt: '2026-01-01', thumbnails: { default: { url: '' } } },
              contentDetails: { duration: 'PT5M' },
              statistics: { viewCount: '100', likeCount: '10' },
            }],
          }), { status: 200 }),
        );

      const context = createContext('이 유튜브 요약해줘 https://youtube.com/watch?v=dQw4w9WgXcQ');
      const result = await route.execute(context);
      expect(result.success).toBe(true);
      expect(result.data).toContain('요약');
    });
  });

  describe('Calendar sub-intent routing', () => {
    it('should route "내일 일정" to calendar_list', async () => {
      const mockAuth = createMockAuth();
      (mockAuth.fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({
          items: [{
            id: 'evt-1',
            summary: '팀 미팅',
            start: { dateTime: '2026-02-08T15:00:00+09:00' },
            end: { dateTime: '2026-02-08T16:00:00+09:00' },
            htmlLink: 'https://cal.google.com/evt-1',
          }],
        }), { status: 200 }),
      );

      const route = new GoogleRoute(mockLogger, mockAuth);
      const context = createContext('내일 일정 알려줘');

      const result = await route.execute(context);
      expect(result.success).toBe(true);
      expect(result.data).toContain('팀 미팅');
    });
  });
});
