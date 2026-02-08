/**
 * ModelARouter Tests
 * Pipeline: message → dedup → AgentLoop.process()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelARouter } from './ModelARouter.js';
import type { ExternalMessage } from '../interface/types.js';

const mockLogger = vi.fn();

function createMessage(content: string, chatId = 'chat-1', updateId = '12345'): ExternalMessage {
  return {
    id: 'msg-1',
    channel: 'telegram',
    chatId,
    userId: 'user-1',
    content,
    type: 'text',
    metadata: { telegramMessageId: updateId },
    timestamp: new Date().toISOString(),
  };
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
  });

  describe('Agent routing', () => {
    it('should delegate to AgentLoop when set', async () => {
      const mockProcess = vi.fn().mockResolvedValue(undefined);
      const mockAgentLoop = {
        process: mockProcess,
        setLogger: vi.fn(),
      };
      router.setAgentLoop(mockAgentLoop as never);

      await router.handleMessage(createMessage('안녕하세요'));

      expect(mockProcess).toHaveBeenCalledTimes(1);
      expect(mockProcess.mock.calls[0][0].content).toBe('안녕하세요');
    });

    it('should send error when AgentLoop not initialized', async () => {
      await router.handleMessage(createMessage('테스트'));

      expect(sentResponses.some((r) =>
        r.content.includes('에이전트가 초기화되지 않았습니다'),
      )).toBe(true);
    });

    it('should catch and report AgentLoop errors', async () => {
      const mockAgentLoop = {
        process: vi.fn().mockRejectedValue(new Error('LLM timeout')),
        setLogger: vi.fn(),
      };
      router.setAgentLoop(mockAgentLoop as never);

      await router.handleMessage(createMessage('에러 유발'));

      expect(sentResponses.some((r) =>
        r.content.includes('LLM timeout'),
      )).toBe(true);
    });
  });

  describe('Dedup (update_id)', () => {
    it('should ignore duplicate update_id', async () => {
      const mockAgentLoop = {
        process: vi.fn().mockResolvedValue(undefined),
        setLogger: vi.fn(),
      };
      router.setAgentLoop(mockAgentLoop as never);

      const msg = createMessage('중복 테스트', 'chat-1', '99999');

      await router.handleMessage(msg);
      await router.handleMessage(msg);

      expect(mockAgentLoop.process).toHaveBeenCalledTimes(1);
    });

    it('should process messages with different update_ids', async () => {
      const mockAgentLoop = {
        process: vi.fn().mockResolvedValue(undefined),
        setLogger: vi.fn(),
      };
      router.setAgentLoop(mockAgentLoop as never);

      await router.handleMessage(createMessage('첫번째', 'chat-1', '100'));
      await router.handleMessage(createMessage('두번째', 'chat-1', '101'));

      expect(mockAgentLoop.process).toHaveBeenCalledTimes(2);
    });
  });

  describe('SmartRouter', () => {
    it('should throw when SmartRouter not set', () => {
      expect(() => router.getSmartRouter()).toThrow('SmartRouter not initialized');
    });

    it('should return SmartRouter when set', () => {
      const mockSR = { route: vi.fn() };
      router.setSmartRouter(mockSR);
      expect(router.getSmartRouter()).toBe(mockSR);
    });
  });

  describe('Callback handlers', () => {
    it('should dispatch callback to registered handler', () => {
      const handler = vi.fn();
      const services = router.buildServices();
      services.registerCallbackHandler('chat-1', handler);

      router.handleCallbackQuery('chat-1', 'button_data');

      expect(handler).toHaveBeenCalledWith('button_data');
    });
  });
});
