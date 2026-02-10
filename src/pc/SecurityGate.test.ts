/**
 * SecurityGate Tests — Phase 6-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityGate, RateLimiter, AuditLogger } from './SecurityGate.js';
import type { IntegrationLogger } from './types.js';

// ============================================================================
// RateLimiter Tests
// ============================================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it('첫 번째 요청은 허용', () => {
    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('30+10(burst) 요청까지 허용', () => {
    for (let i = 0; i < 40; i++) {
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
    }
  });

  it('41번째 요청은 차단', () => {
    for (let i = 0; i < 40; i++) {
      limiter.check('user-1');
    }
    const result = limiter.check('user-1');
    expect(result.allowed).toBe(false);
  });

  it('다른 사용자는 독립 카운터', () => {
    for (let i = 0; i < 40; i++) {
      limiter.check('user-1');
    }
    const result = limiter.check('user-2');
    expect(result.allowed).toBe(true);
  });

  it('리셋 후 허용', () => {
    for (let i = 0; i < 40; i++) {
      limiter.check('user-1');
    }
    limiter.reset('user-1');
    const result = limiter.check('user-1');
    expect(result.allowed).toBe(true);
  });

  it('사용량 조회', () => {
    limiter.check('user-1');
    limiter.check('user-1');
    limiter.check('user-1');
    expect(limiter.getUsage('user-1')).toBe(3);
  });

  it('미등록 사용자 사용량 0', () => {
    expect(limiter.getUsage('unknown')).toBe(0);
  });
});

// ============================================================================
// AuditLogger Tests
// ============================================================================

describe('AuditLogger', () => {
  let logger: IntegrationLogger;
  let audit: AuditLogger;

  beforeEach(() => {
    logger = vi.fn() as IntegrationLogger;
    audit = new AuditLogger(logger);
  });

  it('로그 기록', () => {
    const entry = audit.log({
      userId: 'user-1',
      channel: 'telegram',
      command: 'Gmail 확인',
      module: 'google',
      result: 'success',
      durationMs: 150,
    });
    expect(entry.id).toBe(1);
    expect(entry.timestamp).toBeDefined();
  });

  it('사용자별 쿼리', () => {
    audit.log({ userId: 'user-1', channel: 'telegram', command: 'c1', module: 'google', result: 'success', durationMs: 10 });
    audit.log({ userId: 'user-2', channel: 'slack', command: 'c2', module: 'browser', result: 'success', durationMs: 20 });
    audit.log({ userId: 'user-1', channel: 'telegram', command: 'c3', module: 'voice', result: 'success', durationMs: 30 });

    const results = audit.query('user-1');
    expect(results.length).toBe(2);
  });

  it('전체 쿼리 (limit)', () => {
    for (let i = 0; i < 20; i++) {
      audit.log({ userId: 'user-1', channel: 'web', command: `c${i}`, module: 'general', result: 'success', durationMs: 0 });
    }
    const results = audit.query(undefined, 5);
    expect(results.length).toBe(5);
  });

  it('크기 제한', () => {
    const small = new AuditLogger(logger, 10);
    for (let i = 0; i < 20; i++) {
      small.log({ userId: 'u', channel: 'w', command: `c${i}`, module: 'g', result: 'success', durationMs: 0 });
    }
    expect(small.count()).toBe(10);
  });

  it('클리어', () => {
    audit.log({ userId: 'u', channel: 'w', command: 'c', module: 'g', result: 'success', durationMs: 0 });
    audit.clear();
    expect(audit.count()).toBe(0);
  });

  it('90일 이전 로그 정리', () => {
    const entry = audit.log({
      userId: 'u', channel: 'w', command: 'c', module: 'g', result: 'success', durationMs: 0,
    });
    // Manually set timestamp to 91 days ago
    (entry as { timestamp: string }).timestamp =
      new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const removed = audit.cleanup();
    expect(removed).toBe(1);
  });
});

// ============================================================================
// SecurityGate Tests
// ============================================================================

describe('SecurityGate', () => {
  let logger: IntegrationLogger;
  let gate: SecurityGate;

  beforeEach(() => {
    logger = vi.fn() as IntegrationLogger;
    gate = new SecurityGate(logger);
  });

  it('정상 요청 통과', () => {
    const result = gate.check('user-1', 'telegram', 'Gmail 확인');
    expect(result.allowed).toBe(true);
  });

  it('Rate limit 초과 시 차단', () => {
    for (let i = 0; i < 40; i++) {
      gate.check('user-1', 'telegram', `cmd-${i}`);
    }
    const result = gate.check('user-1', 'telegram', 'cmd-41');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('한도');
  });

  it('Rate limit 차단 시 감사 로그 기록', () => {
    for (let i = 0; i < 41; i++) {
      gate.check('user-1', 'telegram', `cmd-${i}`);
    }
    const entries = gate.getAuditLogger().query('user-1');
    expect(entries.some(e => e.result === 'rate_limited')).toBe(true);
  });

  it('명령 실행 로그 기록', () => {
    gate.logExecution('user-1', 'telegram', 'Gmail 확인', 'google', 'success', 150);
    const entries = gate.getAuditLogger().query('user-1');
    expect(entries.length).toBe(1);
    expect(entries[0].result).toBe('success');
    expect(entries[0].durationMs).toBe(150);
  });

  it('다른 사용자 독립', () => {
    for (let i = 0; i < 40; i++) {
      gate.check('user-1', 'telegram', `cmd-${i}`);
    }
    const result = gate.check('user-2', 'telegram', 'cmd');
    expect(result.allowed).toBe(true);
  });
});
