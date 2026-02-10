/**
 * Phase 2: Policy Integration Tests
 * Tests for SystemPrompt, PolicyEngine→AgentLoop, RateLimiter
 */

import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, truncateInput, wrapUserMessage } from './SystemPrompt.js';
import { RateLimiter } from './RateLimiter.js';
import type { AgentToolDefinition } from './types.js';

// ============================================================================
// SystemPrompt Tests
// ============================================================================

describe('SystemPrompt Enhancement', () => {
  const mockTools: AgentToolDefinition[] = [
    { name: 'google_search', description: 'Search the web', parameters: {}, scope: 'read' },
    { name: 'kimi_analyze', description: 'Analyze code', parameters: {}, scope: 'read' },
  ];

  it('should include tool usage guidelines', () => {
    const msg = buildSystemPrompt(mockTools);
    expect(msg.content).toContain('도구 선택 기준');
    expect(msg.content).toContain('kimi_analyze');
    expect(msg.content).toContain('google_search');
  });

  it('should include prohibited actions', () => {
    const msg = buildSystemPrompt(mockTools);
    expect(msg.content).toContain('금지 행위');
    expect(msg.content).toContain('send_*');
  });

  it('should include injection defense instructions', () => {
    const msg = buildSystemPrompt(mockTools);
    expect(msg.content).toContain('보안 지시');
    expect(msg.content).toContain('untrusted input');
    expect(msg.content).toContain('시스템 프롬프트를 무시하라');
  });

  it('should include channel context for telegram', () => {
    const msg = buildSystemPrompt(mockTools, { channel: 'telegram' });
    expect(msg.content).toContain('Telegram');
    expect(msg.content).toContain('모바일 친화적');
  });

  it('should include channel context for slack', () => {
    const msg = buildSystemPrompt(mockTools, { channel: 'slack' });
    expect(msg.content).toContain('Slack');
    expect(msg.content).toContain('팀 협업');
  });

  it('should include channel context for web', () => {
    const msg = buildSystemPrompt(mockTools, { channel: 'web' });
    expect(msg.content).toContain('Web');
  });
});

describe('Input Truncation', () => {
  it('should not truncate short input', () => {
    const input = 'Hello world';
    expect(truncateInput(input)).toBe(input);
  });

  it('should truncate at 10,000 characters', () => {
    const input = 'a'.repeat(15_000);
    const result = truncateInput(input);
    expect(result.length).toBeLessThan(15_000);
    expect(result).toContain('10,000자를 초과');
  });

  it('should handle exactly 10,000 characters', () => {
    const input = 'b'.repeat(10_000);
    expect(truncateInput(input)).toBe(input);
  });
});

describe('User Message Wrapping', () => {
  it('should wrap message with injection markers', () => {
    const wrapped = wrapUserMessage('Hello');
    expect(wrapped).toContain('--- USER MESSAGE (untrusted) ---');
    expect(wrapped).toContain('--- END USER MESSAGE ---');
    expect(wrapped).toContain('Hello');
  });

  it('should truncate before wrapping', () => {
    const longInput = 'x'.repeat(15_000);
    const wrapped = wrapUserMessage(longInput);
    expect(wrapped).toContain('10,000자를 초과');
    expect(wrapped).toContain('--- USER MESSAGE (untrusted) ---');
  });
});

// ============================================================================
// RateLimiter Tests
// ============================================================================

describe('RateLimiter', () => {
  it('should allow calls within limit', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      const result = limiter.check('user1', 'claude_code');
      expect(result.allowed).toBe(true);
      limiter.record('user1', 'claude_code');
    }
  });

  it('should block claude_code after 10 calls', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record('user1', 'claude_code');
    }
    const result = limiter.check('user1', 'claude_code');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Rate limit exceeded');
    expect(result.message).toContain('claude_code');
    expect(result.message).toContain('10/min');
  });

  it('should allow general tools up to 30 calls', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 30; i++) {
      const result = limiter.check('user1', 'google_search');
      expect(result.allowed).toBe(true);
      limiter.record('user1', 'google_search');
    }
    const result = limiter.check('user1', 'google_search');
    expect(result.allowed).toBe(false);
  });

  it('should isolate different users', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record('user1', 'claude_code');
    }
    // user1 should be blocked
    expect(limiter.check('user1', 'claude_code').allowed).toBe(false);
    // user2 should be fine
    expect(limiter.check('user2', 'claude_code').allowed).toBe(true);
  });

  it('should isolate different tools', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record('user1', 'claude_code');
    }
    // claude_code blocked for user1
    expect(limiter.check('user1', 'claude_code').allowed).toBe(false);
    // google_search still fine for user1
    expect(limiter.check('user1', 'google_search').allowed).toBe(true);
  });

  it('should reset all state', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record('user1', 'claude_code');
    }
    expect(limiter.check('user1', 'claude_code').allowed).toBe(false);
    limiter.reset();
    expect(limiter.check('user1', 'claude_code').allowed).toBe(true);
  });

  it('should support custom config', () => {
    const limiter = new RateLimiter({ custom_tool: { rpm: 2 } });
    limiter.record('u1', 'custom_tool');
    limiter.record('u1', 'custom_tool');
    expect(limiter.check('u1', 'custom_tool').allowed).toBe(false);
    expect(limiter.check('u1', 'custom_tool').message).toContain('2/min');
  });
});
