/**
 * AgentLoop 테스트
 * Phase 2: Scenarios 1, 2, 3, 4, 9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { AgentLoop } from '../AgentLoop.js';
import { ToolRegistry } from '../ToolRegistry.js';
import type { HeadModelSelector } from '../HeadModelSelector.js';
import type { HeadModelProvider, HeadModelResponse } from '../types.js';
import type { ExternalMessage } from '../../interface/types.js';
import type { RouteServices } from '../../router/types.js';

// === Test Helpers ===

function createMockMessage(content: string, chatId = 'test-chat'): ExternalMessage {
  return {
    id: 'msg-1',
    channel: 'telegram',
    chatId,
    userId: 'user-1',
    content,
    type: 'text',
    timestamp: new Date().toISOString(),
  };
}

function createMockServices(): RouteServices {
  return {
    logger: vi.fn(),
    sendTelegram: vi.fn().mockResolvedValue(undefined),
    sendTelegramInlineKeyboard: vi.fn().mockResolvedValue(undefined),
    registerCallbackHandler: vi.fn(),
    unregisterCallbackHandler: vi.fn(),
    router: { handleMessage: vi.fn(), getSmartRouter: vi.fn() },
    config: {
      repos: { aliases: {}, basePaths: [] },
      qa: { autoApproveTools: [], maxWaitSeconds: 60, readOnTimeout: 'approve' as const, writeOnTimeout: 'deny' as const },
      notifications: { quietHoursStart: 23, quietHoursEnd: 7, minIntervalMs: 10000 },
    },
  };
}

function createMockProvider(responses: HeadModelResponse[]): HeadModelProvider {
  let callIndex = 0;
  return {
    provider: 'gpt',
    model: 'gpt-5.3-codex',
    chat: vi.fn().mockImplementation(async () => {
      const resp = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return resp;
    }),
  };
}

function createMockSelector(provider: HeadModelProvider): HeadModelSelector {
  return {
    selectHead: vi.fn().mockResolvedValue(provider),
    reportSuccess: vi.fn(),
    reportFailure: vi.fn(),
    getCircuitBreakerState: vi.fn().mockReturnValue({ failureCount: 0, lastFailure: 0, isOpen: false, halfOpenAttempted: false }),
    getClaudeProvider: vi.fn(),
  } as unknown as HeadModelSelector;
}

describe('AgentLoop', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ToolRegistry();
  });

  // Scenario 1: 단순 텍스트 응답
  describe('Scenario 1: Simple text response', () => {
    it('should respond with text when HeadModel returns no tool calls', async () => {
      const provider = createMockProvider([
        { content: '안녕하세요! 무엇을 도와드릴까요?', finishReason: 'end_turn', model: 'gpt-5.3-codex' },
      ]);
      const selector = createMockSelector(provider);
      const services = createMockServices();

      const loop = new AgentLoop({ headSelector: selector, toolRegistry: registry });
      await loop.process(createMockMessage('안녕하세요'), services);

      expect(services.sendTelegram).toHaveBeenCalledWith(
        'test-chat',
        '안녕하세요! 무엇을 도와드릴까요?',
        { format: 'markdown' },
      );
    });
  });

  // Scenario 2: Single Tool Call
  describe('Scenario 2: Single tool call', () => {
    it('should execute tool and return final response', async () => {
      registry.register({
        name: 'google_search',
        description: 'Search the web',
        schema: z.object({ query: z.string() }),
        handler: async () => '서울 날씨: 맑음, 15도',
        scope: 'read',
      });

      const provider = createMockProvider([
        {
          content: '',
          toolCalls: [{ id: 'tc-1', name: 'google_search', arguments: { query: '오늘 날씨' } }],
          finishReason: 'tool_use',
          model: 'gpt-5.3-codex',
        },
        {
          content: '오늘 서울 날씨는 맑고 15도입니다.',
          finishReason: 'end_turn',
          model: 'gpt-5.3-codex',
        },
      ]);
      const selector = createMockSelector(provider);
      const services = createMockServices();

      const loop = new AgentLoop({ headSelector: selector, toolRegistry: registry });
      await loop.process(createMockMessage('오늘 날씨 알려줘'), services);

      expect(provider.chat).toHaveBeenCalledTimes(2);
      expect(services.sendTelegram).toHaveBeenCalledWith(
        'test-chat',
        '오늘 서울 날씨는 맑고 15도입니다.',
        { format: 'markdown' },
      );
    });
  });

  // Scenario 3: Multi-turn Tool Call
  describe('Scenario 3: Multi-turn tool calls', () => {
    it('should handle sequential tool calls', async () => {
      registry.register({
        name: 'kimi_analyze',
        description: 'Analyze code',
        schema: z.object({ content: z.string() }),
        handler: async () => 'SQL injection vulnerability found',
        scope: 'read',
      });

      const provider = createMockProvider([
        {
          content: '코드를 분석하겠습니다.',
          toolCalls: [{ id: 'tc-1', name: 'kimi_analyze', arguments: { content: 'login code' } }],
          finishReason: 'tool_use',
          model: 'gpt-5.3-codex',
        },
        {
          content: '분석 결과, SQL injection 취약점이 발견되었습니다.',
          finishReason: 'end_turn',
          model: 'gpt-5.3-codex',
        },
      ]);
      const selector = createMockSelector(provider);
      const services = createMockServices();

      const loop = new AgentLoop({ headSelector: selector, toolRegistry: registry });
      await loop.process(createMockMessage('로그인 코드 분석해줘'), services);

      expect(provider.chat).toHaveBeenCalledTimes(2);
      expect(services.sendTelegram).toHaveBeenCalledWith(
        'test-chat',
        '분석 결과, SQL injection 취약점이 발견되었습니다.',
        { format: 'markdown' },
      );
    });
  });

  // Scenario 4: Max Iterations
  describe('Scenario 4: Max iterations exceeded', () => {
    it('should stop after 10 iterations and send error message', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        schema: z.object({ input: z.string() }),
        handler: async () => 'result',
        scope: 'read',
      });

      // HeadModel always returns tool calls (infinite loop scenario)
      const infiniteToolCall: HeadModelResponse = {
        content: '',
        toolCalls: [{ id: `tc-${Math.random()}`, name: 'test_tool', arguments: { input: 'test' } }],
        finishReason: 'tool_use',
        model: 'gpt-5.3-codex',
      };

      let callCount = 0;
      const provider: HeadModelProvider = {
        provider: 'gpt',
        model: 'gpt-5.3-codex',
        chat: vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            ...infiniteToolCall,
            toolCalls: [{ id: `tc-${callCount}`, name: 'test_tool', arguments: { input: 'test' } }],
          };
        }),
      };
      const selector = createMockSelector(provider);
      const services = createMockServices();

      const loop = new AgentLoop({ headSelector: selector, toolRegistry: registry });
      await loop.process(createMockMessage('무한 루프 테스트'), services);

      expect(provider.chat).toHaveBeenCalledTimes(10);
      expect(services.sendTelegram).toHaveBeenCalledWith(
        'test-chat',
        '처리 한도(10회)를 초과했습니다. 요청을 더 구체적으로 해주세요.',
      );
    });
  });

  // Scenario 9: HeadModel API failure
  describe('Scenario 9: HeadModel API failure', () => {
    it('should send error message on API failure', async () => {
      const provider: HeadModelProvider = {
        provider: 'gpt',
        model: 'gpt-5.3-codex',
        chat: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const selector = createMockSelector(provider);
      const services = createMockServices();

      const loop = new AgentLoop({ headSelector: selector, toolRegistry: registry });
      await loop.process(createMockMessage('테스트'), services);

      expect(services.sendTelegram).toHaveBeenCalledWith(
        'test-chat',
        'AI 모델 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
      expect(selector.reportFailure).toHaveBeenCalled();
    });
  });
});
