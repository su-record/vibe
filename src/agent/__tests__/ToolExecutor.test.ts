/**
 * ToolExecutor 테스트
 * Phase 2: Scenarios 5, 8 (Tool timeout, Dedup preserved)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolExecutor, truncateResult, maskSensitiveFields } from '../ToolExecutor.js';
import { ToolRegistry } from '../ToolRegistry.js';

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ToolRegistry();
    executor = new ToolExecutor(vi.fn());
  });

  // Scenario 5: Tool Execution Timeout
  describe('Scenario 5: Tool execution timeout', () => {
    it('should timeout after 30 seconds', async () => {
      registry.register({
        name: 'slow_tool',
        description: 'Slow tool',
        schema: z.object({}),
        handler: async () => {
          await new Promise((r) => setTimeout(r, 60_000));
          return 'done';
        },
        scope: 'execute',
      });

      const result = await executor.execute(
        { id: 'tc-1', name: 'slow_tool', arguments: {} },
        registry,
      );

      expect(result.status).toBe('timeout');
      expect(result.content).toContain('timed out');
    }, 35_000);

    it('should return success for fast tool', async () => {
      registry.register({
        name: 'fast_tool',
        description: 'Fast tool',
        schema: z.object({ input: z.string() }),
        handler: async (args) => `Result: ${(args as { input: string }).input}`,
        scope: 'read',
      });

      const result = await executor.execute(
        { id: 'tc-1', name: 'fast_tool', arguments: { input: 'hello' } },
        registry,
      );

      expect(result.status).toBe('success');
      expect(result.content).toBe('Result: hello');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tool not found', () => {
    it('should return error for unknown tool', async () => {
      const result = await executor.execute(
        { id: 'tc-1', name: 'nonexistent', arguments: {} },
        registry,
      );

      expect(result.status).toBe('error');
      expect(result.content).toContain('not found');
    });
  });

  describe('Validation failure', () => {
    it('should return error for invalid arguments', async () => {
      registry.register({
        name: 'typed_tool',
        description: 'Typed tool',
        schema: z.object({ count: z.number() }),
        handler: async () => 'ok',
        scope: 'read',
      });

      const result = await executor.execute(
        { id: 'tc-1', name: 'typed_tool', arguments: { count: 'not-a-number' } },
        registry,
      );

      expect(result.status).toBe('error');
      expect(result.content).toContain('Invalid arguments');
    });
  });

  describe('Audit logging', () => {
    it('should record audit entries', async () => {
      registry.register({
        name: 'audit_tool',
        description: 'Auditable',
        schema: z.object({ query: z.string() }),
        handler: async () => 'done',
        scope: 'read',
      });

      await executor.execute(
        { id: 'tc-1', name: 'audit_tool', arguments: { query: 'test' } },
        registry,
      );

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
