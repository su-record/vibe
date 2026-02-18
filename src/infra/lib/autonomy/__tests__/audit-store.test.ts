import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { AuditStore } from '../AuditStore.js';

let storage: MemoryStorage;
let store: AuditStore;
let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = new MemoryStorage(testDir);
  store = new AuditStore(storage as unknown as { getDatabase: () => ReturnType<typeof storage.getDatabase> });
});

afterEach(() => {
  storage.close();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors on Windows
  }
});

// Scenario 3: Immutable Audit Log
describe('Scenario 3: Immutable Audit Log', () => {
  it('should prevent UPDATE on audit_events', () => {
    const id = store.record({
      correlationId: 'corr-1',
      eventType: 'agent_action',
      payload: { action: 'test' },
    });

    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): { run(...args: unknown[]): void };
    };

    expect(() => {
      db.prepare('UPDATE audit_events SET eventType = ? WHERE id = ?').run('hacked', id);
    }).toThrow(/immutable/i);
  });

  it('should prevent DELETE on audit_events', () => {
    store.record({
      correlationId: 'corr-1',
      eventType: 'agent_action',
      payload: { action: 'test' },
    });

    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): { run(...args: unknown[]): void };
    };

    expect(() => {
      db.prepare('DELETE FROM audit_events WHERE correlationId = ?').run('corr-1');
    }).toThrow(/immutable/i);
  });

  it('should allow INSERT (append-only)', () => {
    const id = store.record({
      correlationId: 'corr-1',
      eventType: 'agent_action',
      payload: { action: 'test' },
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });
});

// Scenario 4: 감사 로그 필터링 조회
describe('Scenario 4: 감사 로그 필터링 조회', () => {
  beforeEach(() => {
    const events = [];
    for (let i = 0; i < 100; i++) {
      events.push({
        correlationId: `corr-${i}`,
        eventType: i % 2 === 0 ? 'agent_action' : 'policy_check',
        agentId: i % 3 === 0 ? 'implementer' : 'explorer',
        riskLevel: i % 4 === 0 ? 'HIGH' : i % 2 === 0 ? 'MEDIUM' : 'LOW',
        payload: { index: i },
        outcome: i % 5 === 0 ? 'blocked' : 'allowed',
      });
    }
    store.recordBatch(events);
  });

  it('should filter by agentId and riskLevel', () => {
    const results = store.query({ agentId: 'implementer', riskLevel: 'HIGH' });

    for (const row of results) {
      expect(row.agentId).toBe('implementer');
      expect(row.riskLevel).toBe('HIGH');
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return results in descending order by createdAt', () => {
    const results = store.query({ limit: 10 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].createdAt >= results[i].createdAt).toBe(true);
    }
  });

  it('should apply pagination', () => {
    const page1 = store.query({ limit: 10, offset: 0 });
    const page2 = store.query({ limit: 10, offset: 10 });

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it('should cap limit at MAX_PAGE_SIZE (200)', () => {
    const results = store.query({ limit: 500 });
    expect(results.length).toBeLessThanOrEqual(200);
  });

  it('should filter by eventType', () => {
    const results = store.query({ eventType: 'policy_check' });
    for (const row of results) {
      expect(row.eventType).toBe('policy_check');
    }
  });

  it('should return stats', () => {
    const stats = store.getStats();
    expect(stats.totalEvents).toBe(100);
    expect(stats.byEventType).toHaveProperty('agent_action');
    expect(stats.byEventType).toHaveProperty('policy_check');
    expect(stats.blockedCount).toBeGreaterThan(0);
    expect(stats.blockedRate).toBeGreaterThan(0);
    expect(stats.blockedRate).toBeLessThan(1);
  });
});

// Scenario 5: Correlation ID 이벤트 체인 조회
describe('Scenario 5: Correlation ID 이벤트 체인 조회', () => {
  it('should return related events by correlationId in time order', () => {
    const correlationId = 'chain-001';

    store.record({
      correlationId,
      eventType: 'agent_action',
      agentId: 'implementer',
      payload: { step: 'request' },
    });
    store.record({
      correlationId,
      eventType: 'policy_check',
      agentId: 'sentinel',
      payload: { step: 'check' },
    });
    store.record({
      correlationId,
      eventType: 'action_executed',
      agentId: 'implementer',
      payload: { step: 'execute' },
    });

    const chain = store.getByCorrelation(correlationId);

    expect(chain).toHaveLength(3);
    expect(chain[0].eventType).toBe('agent_action');
    expect(chain[1].eventType).toBe('policy_check');
    expect(chain[2].eventType).toBe('action_executed');

    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].createdAt >= chain[i - 1].createdAt).toBe(true);
    }
  });
});

// Sensitive data redaction
describe('Sensitive data redaction', () => {
  it('should redact API keys', () => {
    const payload = JSON.stringify({ key: 'sk-abc1234567890abcdefgh' });
    const redacted = AuditStore.redactSensitive(payload);
    expect(redacted).toContain('[REDACTED:API_KEY]');
    expect(redacted).not.toContain('sk-abc1234567890abcdefgh');
  });

  it('should redact Bearer tokens', () => {
    const payload = JSON.stringify({ auth: 'Bearer eyJhbGciOiJIUzI1NiJ9.test' });
    const redacted = AuditStore.redactSensitive(payload);
    expect(redacted).toContain('Bearer [REDACTED]');
  });

  it('should redact password fields', () => {
    const payload = '{"password": "my-secret-pass"}';
    const redacted = AuditStore.redactSensitive(payload);
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('my-secret-pass');
  });
});

// FTS5 search
describe('FTS5 search', () => {
  it('should find events by text search', () => {
    store.record({
      correlationId: 'fts-1',
      eventType: 'agent_action',
      agentId: 'implementer',
      payload: { description: 'creating login component' },
    });
    store.record({
      correlationId: 'fts-2',
      eventType: 'policy_check',
      agentId: 'sentinel',
      payload: { description: 'checking permissions' },
    });

    const results = store.search('implementer');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].agentId).toBe('implementer');
  });

  it('should sanitize FTS query special characters', () => {
    store.record({
      correlationId: 'fts-3',
      eventType: 'test_event',
      payload: { data: 'test value' },
    });

    // Should not throw with special characters
    const results = store.search('test* AND "value"');
    // May or may not find results depending on sanitization, but shouldn't throw
    expect(Array.isArray(results)).toBe(true);
  });
});
