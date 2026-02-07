/**
 * ModelARouter Integration Tests
 * Full pipeline: message → classify → route → execute → respond
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelARouter } from './ModelARouter.js';
import { ExternalMessage } from '../interface/types.js';
import { SmartRouterLike, ClassifiedIntent, RouteContext, RouteResult } from './types.js';
import { BaseRoute } from './routes/BaseRoute.js';

const mockLogger = vi.fn();

function createMessage(content: string, chatId: string = 'chat-1'): ExternalMessage {
  return {
    id: 'msg-1',
    channel: 'telegram',
    chatId,
    userId: 'user-1',
    content,
    type: 'text',
    metadata: { telegramMessageId: '12345' },
    timestamp: new Date().toISOString(),
  };
}

/** Simple test route */
class TestRoute extends BaseRoute {
  readonly name = 'test';
  private category: string;
  public executeFn: (context: RouteContext) => Promise<RouteResult>;

  constructor(category: string, executeFn?: (context: RouteContext) => Promise<RouteResult>) {
    super(mockLogger);
    this.category = category;
    this.executeFn = executeFn ?? (async () => ({ success: true, data: 'done' }));
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === this.category;
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    return this.executeFn(context);
  }
}

describe('ModelARouter', () => {
  let router: ModelARouter;
  let sentResponses: Array<{ chatId: string; content: string }>;

  beforeEach(() => {
    mockLogger.mockClear();
    sentResponses = [];

    router = new ModelARouter(mockLogger);
    router.setSendResponse(async (response) => {
      sentResponses.push({ chatId: response.chatId, content: response.content });
    });

    // Setup notification manager
    router.getNotificationManager().setSendFunction(async (chatId, text) => {
      sentResponses.push({ chatId, content: text });
    });
  });

  describe('Intent classification pipeline', () => {
    it('should route /dev command to development route', async () => {
      const devRoute = new TestRoute('development');
      router.getRegistry().register(devRoute);

      await router.handleMessage(createMessage('/dev test project'));

      // Should have sent at least one response
      expect(sentResponses.length).toBeGreaterThan(0);
    });

    it('should handle conversation intent without routes', async () => {
      const mockSmartRouter: SmartRouterLike = {
        route: vi.fn().mockResolvedValue({
          content: 'Hello! How can I help?',
          success: true,
        }),
      };
      router.setSmartRouter(mockSmartRouter);

      await router.handleMessage(createMessage('안녕, 오늘 날씨 어때?'));

      expect(sentResponses.some((r) => r.content.includes('Hello'))).toBe(true);
    });

    it('should handle composite intent with not-ready message', async () => {
      await router.handleMessage(createMessage('검색해서 메일로 보내줘'));

      expect(sentResponses.some((r) =>
        r.content.includes('복합 명령은 아직 지원하지 않습니다'),
      )).toBe(true);
    });
  });

  describe('Dedup (update_id)', () => {
    it('should ignore duplicate update_id', async () => {
      const devRoute = new TestRoute('development');
      router.getRegistry().register(devRoute);

      const msg = createMessage('/dev test');

      await router.handleMessage(msg);
      const firstCount = sentResponses.length;

      await router.handleMessage(msg);
      // Second call should not add more responses (deduped)
      expect(sentResponses.length).toBe(firstCount);
    });
  });

  describe('Error handling', () => {
    it('should send error message when route execution fails', async () => {
      const failRoute = new TestRoute('development', async () => ({
        success: false,
        error: '테스트 에러',
      }));
      router.getRegistry().register(failRoute);

      await router.handleMessage(createMessage('/dev fail'));

      expect(sentResponses.some((r) => r.content.includes('테스트 에러'))).toBe(true);
    });

    it('should send error when no route matches', async () => {
      // No routes registered, and using /dev which classifies as development
      await router.handleMessage(createMessage('/dev test'));

      expect(sentResponses.some((r) =>
        r.content.includes('라우트가 없습니다'),
      )).toBe(true);
    });
  });

  describe('Route result handling', () => {
    it('should send success result to user', async () => {
      const successRoute = new TestRoute('development', async () => ({
        success: true,
        data: '작업 완료!',
      }));
      router.getRegistry().register(successRoute);

      await router.handleMessage(createMessage('/dev test'));

      expect(sentResponses.some((r) => r.content.includes('작업 완료'))).toBe(true);
    });
  });
});
