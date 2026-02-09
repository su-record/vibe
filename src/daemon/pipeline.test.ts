/**
 * Phase 1: Pipeline Integration Tests
 * Tests for SessionPool → AgentLoop → HeadModel → ToolExecutor pipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'node:crypto';
import { SessionPool } from './SessionPool.js';
import type { DaemonConfig, LogLevel } from './types.js';
import type { ToolDefinition, HeadModelProvider, HeadModelResponse, AgentMessage, AgentToolDefinition } from '../agent/types.js';
import { HeadModelSelector } from '../agent/HeadModelSelector.js';

// ============================================================================
// Test Helpers
// ============================================================================

function makeTestConfig(): DaemonConfig {
  const id = crypto.randomBytes(4).toString('hex');
  return {
    socketPath: `/tmp/test-${id}.sock`,
    pidFile: `/tmp/test-${id}.pid`,
    tokenFile: `/tmp/test-${id}.token`,
    logDir: '/tmp',
    logFile: `/tmp/test-${id}.log`,
    maxPayloadBytes: 1024 * 1024,
    ipcTimeoutMs: 5000,
    gracefulShutdownMs: 3000,
    maxGlobalSessions: 5,
    maxSessionsPerProject: 1,
    idleSessionTimeoutMs: 30 * 60 * 1000,
    sessionReconnectMaxRetries: 1,
  };
}

const logs: string[] = [];
const testLogger = (level: LogLevel, msg: string, _data?: unknown): void => {
  logs.push(`[${level}] ${msg}`);
};

/** Create a mock HeadModelProvider that returns a fixed text response */
function createMockHeadModel(responseText: string): HeadModelProvider {
  return {
    model: 'mock-gpt-5.3',
    provider: 'gpt' as const,
    chat: async (_messages: AgentMessage[], _tools?: AgentToolDefinition[]): Promise<HeadModelResponse> => ({
      content: responseText,
      model: 'mock-gpt-5.3',
      toolCalls: [],
      finishReason: 'stop',
    }),
  };
}

/** Create a mock HeadModelProvider that calls a tool then responds */
function createToolCallingHeadModel(
  toolName: string,
  toolArgs: Record<string, unknown>,
  finalResponse: string,
): HeadModelProvider {
  let callCount = 0;
  return {
    model: 'mock-gpt-5.3',
    provider: 'gpt' as const,
    chat: async (_messages: AgentMessage[], _tools?: AgentToolDefinition[]): Promise<HeadModelResponse> => {
      callCount++;
      if (callCount === 1) {
        return {
          content: '',
          model: 'mock-gpt-5.3',
          toolCalls: [{
            id: `call_${callCount}`,
            name: toolName,
            arguments: toolArgs,
          }],
          finishReason: 'tool_calls',
        };
      }
      return {
        content: finalResponse,
        model: 'mock-gpt-5.3',
        toolCalls: [],
        finishReason: 'stop',
      };
    },
  };
}

/** Create a mock tool definition */
function createMockTool(name: string, handler?: (args: Record<string, unknown>) => Promise<string>): ToolDefinition {
  return {
    name,
    description: `Mock tool: ${name}`,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input text' },
      },
    },
    handler: handler ?? (async (args: Record<string, unknown>) => `Result for ${name}: ${JSON.stringify(args)}`),
    scope: 'read',
  };
}

/** Create a mock HeadModelSelector that returns the given provider */
function createMockHeadSelector(provider: HeadModelProvider): HeadModelSelector {
  const selector = new HeadModelSelector();
  // Override selectHead to return our mock
  vi.spyOn(selector, 'selectHead').mockResolvedValue(provider);
  vi.spyOn(selector, 'reportSuccess').mockImplementation(() => {});
  vi.spyOn(selector, 'reportFailure').mockImplementation(() => {});
  return selector;
}

// ============================================================================
// Tests
// ============================================================================

describe('Pipeline Integration', () => {
  let pool: SessionPool;
  let config: DaemonConfig;

  beforeEach(() => {
    logs.length = 0;
    config = makeTestConfig();
    pool = new SessionPool(config, testLogger);
    pool.start();
  });

  describe('Scenario 1: SessionPool → AgentLoop basic flow', () => {
    it('should process a message through AgentLoop and return AI response', async () => {
      const mockModel = createMockHeadModel('안녕하세요! 도움이 필요하신가요?');
      const mockSelector = createMockHeadSelector(mockModel);
      const mockTools = [createMockTool('test_tool')];

      pool.setAgentDeps({ headSelector: mockSelector, tools: mockTools });

      const session = pool.getOrCreateSession('/test/project');
      const result = await pool.sendRequest(
        session.id,
        '안녕하세요',
        'chat-123',
        'telegram',
      );

      expect(result).toContain('안녕하세요! 도움이 필요하신가요?');
    });
  });

  describe('Scenario 2: Tool execution through pipeline', () => {
    it('should execute tools via AgentLoop and return final response', async () => {
      const mockModel = createToolCallingHeadModel(
        'test_tool',
        { input: 'hello' },
        '도구 실행 결과를 확인했습니다.',
      );
      const mockSelector = createMockHeadSelector(mockModel);
      const mockTools = [createMockTool('test_tool')];

      pool.setAgentDeps({ headSelector: mockSelector, tools: mockTools });

      const session = pool.getOrCreateSession('/test/project');
      const result = await pool.sendRequest(
        session.id,
        'test_tool을 실행해줘',
        'chat-456',
        'telegram',
      );

      expect(result).toContain('도구 실행 결과를 확인했습니다.');
    });
  });

  describe('Scenario 3: STUB fallback when no agent deps', () => {
    it('should return stub response when agent deps not set', async () => {
      // Don't call setAgentDeps
      const session = pool.getOrCreateSession('/test/project');
      const result = await pool.sendRequest(session.id, 'hello');

      expect(result).toContain('Request received');
      expect(result).toContain(session.id);
    });
  });

  describe('Scenario 4: Queue depth limit', () => {
    it('should return busy message when queue is full', async () => {
      // Create a slow model that takes a while
      const slowModel: HeadModelProvider = {
        model: 'slow-model',
        provider: 'gpt' as const,
        chat: async (): Promise<HeadModelResponse> => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return {
            content: 'slow response',
            model: 'slow',
            toolCalls: [],
            finishReason: 'stop',
          };
        },
      };

      const mockSelector = createMockHeadSelector(slowModel);
      pool.setAgentDeps({ headSelector: mockSelector, tools: [createMockTool('noop')] });

      const session = pool.getOrCreateSession('/test/project');

      // Fill the queue (first request will start processing, remaining queue up)
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 7; i++) {
        promises.push(pool.sendRequest(session.id, `msg-${i}`, 'chat', 'telegram'));
      }

      // The last couple should get busy response
      const results = await Promise.all(promises);
      const busyResults = results.filter((r) => r.includes('처리 중인 요청이 많습니다'));
      expect(busyResults.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario 5: Multi-channel isolation', () => {
    it('should handle telegram and slack channels independently', async () => {
      const mockModel = createMockHeadModel('Channel response');
      const mockSelector = createMockHeadSelector(mockModel);
      const mockTools = [createMockTool('test_tool')];

      pool.setAgentDeps({ headSelector: mockSelector, tools: mockTools });

      const session1 = pool.getOrCreateSession('/project1');
      const session2 = pool.getOrCreateSession('/project2');

      const [result1, result2] = await Promise.all([
        pool.sendRequest(session1.id, 'telegram msg', 'tg-chat', 'telegram'),
        pool.sendRequest(session2.id, 'slack msg', 'slack-chat', 'slack'),
      ]);

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
    });
  });

  describe('Scenario 6: Session reuse', () => {
    it('should reuse AgentLoop for the same session', async () => {
      const mockModel = createMockHeadModel('Response');
      const mockSelector = createMockHeadSelector(mockModel);

      pool.setAgentDeps({ headSelector: mockSelector, tools: [createMockTool('noop')] });

      const session = pool.getOrCreateSession('/test/project');

      // Send two requests to the same session
      await pool.sendRequest(session.id, 'first', 'chat-1', 'telegram');
      await pool.sendRequest(session.id, 'second', 'chat-1', 'telegram');

      // Check logs for AgentLoop creation — should only be created once
      const creationLogs = logs.filter((l) => l.includes('Created AgentLoop'));
      expect(creationLogs.length).toBe(1);
    });
  });

  describe('Scenario 7: Request serialization', () => {
    it('should serialize requests within the same session', async () => {
      const executionOrder: number[] = [];
      let callCount = 0;

      const orderedModel: HeadModelProvider = {
        model: 'ordered-model',
        provider: 'gpt' as const,
        chat: async (): Promise<HeadModelResponse> => {
          const myOrder = ++callCount;
          await new Promise((resolve) => setTimeout(resolve, 50));
          executionOrder.push(myOrder);
          return {
            content: `Response ${myOrder}`,
            model: 'test',
            toolCalls: [],
            finishReason: 'stop',
          };
        },
      };

      const mockSelector = createMockHeadSelector(orderedModel);
      pool.setAgentDeps({ headSelector: mockSelector, tools: [createMockTool('noop')] });

      const session = pool.getOrCreateSession('/test/project');

      // Send 3 requests concurrently to the same session
      const [r1, r2, r3] = await Promise.all([
        pool.sendRequest(session.id, 'msg1', 'chat', 'telegram'),
        pool.sendRequest(session.id, 'msg2', 'chat', 'telegram'),
        pool.sendRequest(session.id, 'msg3', 'chat', 'telegram'),
      ]);

      // All should succeed
      expect(r1).toBeTruthy();
      expect(r2).toBeTruthy();
      expect(r3).toBeTruthy();

      // Execution should be sequential (serialized)
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('Scenario 8: Error handling', () => {
    it('should return user-friendly error on HeadModel failure', async () => {
      const failingModel: HeadModelProvider = {
        model: 'failing-model',
        provider: 'gpt' as const,
        chat: async (): Promise<HeadModelResponse> => {
          throw new Error('API rate limit exceeded');
        },
      };

      const mockSelector = createMockHeadSelector(failingModel);
      pool.setAgentDeps({ headSelector: mockSelector, tools: [createMockTool('noop')] });

      const session = pool.getOrCreateSession('/test/project');

      // Should not throw — returns user-friendly response
      const result = await pool.sendRequest(session.id, 'hello', 'chat-1', 'telegram');

      // The response should contain the collected text (which is the error message from AgentLoop)
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
