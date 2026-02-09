/**
 * ToolExecutor 테스트
 * Phase 2: Scenarios 5, 8 (Tool timeout, Dedup preserved)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor, truncateResult, maskSensitiveFields } from '../ToolExecutor.js';
import type { ToolDefinition } from '../types.js';

describe('ToolExecutor', () => {
  let tools: ToolDefinition[];
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = [];
    executor = new ToolExecutor(vi.fn(), tools);
  });

  // Scenario 5: Tool Execution Timeout
  describe('Scenario 5: Tool execution timeout', () => {
    it('should timeout after 30 seconds', async () => {
      const testTools: ToolDefinition[] = [
        {
          name: 'slow_tool',
          description: 'Slow tool',
          parameters: { type: 'object', properties: {}, required: [] },
          handler: async () => {
            await new Promise((r) => setTimeout(r, 60_000));
            return 'done';
          },
          scope: 'execute',
        },
      ];
      const executor = new ToolExecutor(vi.fn(), testTools);

      const result = await executor.execute({ id: 'tc-1', name: 'slow_tool', arguments: {} });

      expect(result.status).toBe('timeout');
      expect(result.content).toContain('timed out');
    }, 35_000);

    it('should return success for fast tool', async () => {
      const testTools: ToolDefinition[] = [
        {
          name: 'fast_tool',
          description: 'Fast tool',
          parameters: {
            type: 'object',
            properties: { input: { type: 'string' } },
            required: ['input'],
          },
          handler: async (args) => `Result: ${(args as { input: string }).input}`,
          scope: 'read',
        },
      ];
      const executor = new ToolExecutor(vi.fn(), testTools);

      const result = await executor.execute({ id: 'tc-1', name: 'fast_tool', arguments: { input: 'hello' } });

      expect(result.status).toBe('success');
      expect(result.content).toBe('Result: hello');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tool not found', () => {
    it('should return error for unknown tool', async () => {
      const result = await executor.execute({ id: 'tc-1', name: 'nonexistent', arguments: {} });

      expect(result.status).toBe('error');
      expect(result.content).toContain('not found');
    });
  });

  describe('Validation failure', () => {
    it('should return error when handler throws validation error', async () => {
      const testTools: ToolDefinition[] = [
        {
          name: 'typed_tool',
          description: 'Typed tool',
          parameters: {
            type: 'object',
            properties: { count: { type: 'number' } },
            required: ['count'],
          },
          handler: async (args) => {
            // Handler validates and throws if invalid
            if (typeof args.count !== 'number') {
              throw new Error('Invalid arguments: count must be a number');
            }
            return 'ok';
          },
          scope: 'read',
        },
      ];
      const executor = new ToolExecutor(vi.fn(), testTools);

      const result = await executor.execute({ id: 'tc-1', name: 'typed_tool', arguments: { count: 'not-a-number' } });

      expect(result.status).toBe('error');
      expect(result.content).toContain('Invalid arguments');
    });
  });

  describe('Audit logging', () => {
    it('should record audit entries', async () => {
      const testTools: ToolDefinition[] = [
        {
          name: 'audit_tool',
          description: 'Auditable',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
          handler: async () => 'done',
          scope: 'read',
        },
      ];
      const executor = new ToolExecutor(vi.fn(), testTools);

      await executor.execute({ id: 'tc-1', name: 'audit_tool', arguments: { query: 'test' } });

      const logs = executor.getAuditLog();
      expect(logs).toHaveLength(1);
      expect(logs[0].toolName).toBe('audit_tool');
      expect(logs[0].success).toBe(true);
    });
  });
});

describe('truncateResult', () => {
  it('should not truncate small results', () => {
    expect(truncateResult('hello')).toBe('hello');
  });

  it('should truncate large results', () => {
    const large = 'x'.repeat(20_000);
    const result = truncateResult(large);
    expect(result.length).toBeLessThan(large.length);
    expect(result).toContain('truncated');
  });
});

describe('maskSensitiveFields', () => {
  it('should mask sensitive keys', () => {
    const args = { apiKey: 'sk-secret', query: 'test', authToken: '123' };
    const masked = maskSensitiveFields(args);
    expect(masked.apiKey).toBe('***');
    expect(masked.query).toBe('test');
    expect(masked.authToken).toBe('***');
  });

  it('should not mask non-sensitive keys', () => {
    const args = { name: 'John', count: 5 };
    const masked = maskSensitiveFields(args);
    expect(masked.name).toBe('John');
    expect(masked.count).toBe(5);
  });
});
