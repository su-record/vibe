import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { EventBus } from '../EventBus.js';
import { ConfirmationStore, InvalidTransitionError } from '../ConfirmationStore.js';
import { ConfirmationManager } from '../ConfirmationManager.js';
import { NotificationDispatcher } from '../NotificationDispatcher.js';
import type { NotificationChannel } from '../NotificationDispatcher.js';
import type { ConfirmationRow } from '../ConfirmationStore.js';

let storage: MemoryStorage;
let bus: EventBus;
let testDir: string;

const asStorage = (s: MemoryStorage): { getDatabase: () => ReturnType<typeof s.getDatabase> } =>
  s as unknown as { getDatabase: () => ReturnType<typeof s.getDatabase> };

function mockChannel(name: string, shouldSucceed = true): NotificationChannel {
  return {
    name,
    send: vi.fn().mockResolvedValue(shouldSucceed),
  };
}

function failChannel(name: string): NotificationChannel {
  return {
    name,
    send: vi.fn().mockRejectedValue(new Error(`${name} failed`)),
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `gov-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = new MemoryStorage(testDir);
  bus = new EventBus();
});

afterEach(() => {
  storage.close();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ══════════════════════════════════════════════════
// Scenario 1: 확인 요청 생성
// ══════════════════════════════════════════════════
describe('Scenario 1: ConfirmationStore create', () => {
  it('should create a pending confirmation', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-1',
      actionType: 'file_write',
      actionSummary: 'Write to sensitive file',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: ['Sensitive file'],
    });

    expect(row.id).toBeDefined();
    expect(row.status).toBe('pending');
    expect(row.correlationId).toBe('corr-1');
    expect(row.riskScore).toBe(80);
  });

  it('should set expiresAt to ~300s from now', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const before = Date.now();
    const row = store.create({
      correlationId: 'corr-2',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });
    const after = Date.now();

    const expiresAt = new Date(row.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 299_000);
    expect(expiresAt).toBeLessThanOrEqual(after + 301_000);
  });

  it('should accept custom timeout', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-3',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
      timeoutSeconds: 60,
    });

    const remaining = new Date(row.expiresAt).getTime() - Date.now();
    expect(remaining).toBeLessThanOrEqual(61_000);
    expect(remaining).toBeGreaterThanOrEqual(59_000);
  });
});

// ══════════════════════════════════════════════════
// Scenario 2: 잘못된 상태 전환 차단
// ══════════════════════════════════════════════════
describe('Scenario 2: Invalid state transitions', () => {
  it('should throw InvalidTransitionError on approved→pending', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-inv',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });
    store.resolve(row.id, 'approved', 'OK');

    expect(() => {
      store.resolve(row.id, 'pending' as never);
    }).toThrow(InvalidTransitionError);
  });

  it('should throw InvalidTransitionError on rejected→approved', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-inv2',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });
    store.resolve(row.id, 'rejected', 'No');

    expect(() => {
      store.resolve(row.id, 'approved');
    }).toThrow(InvalidTransitionError);
  });

  it('should throw InvalidTransitionError on expired→approved', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-inv3',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });
    store.resolve(row.id, 'expired');

    expect(() => {
      store.resolve(row.id, 'approved');
    }).toThrow(InvalidTransitionError);
  });

  it('should support all valid transitions from pending', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const statuses = ['approved', 'rejected', 'expired', 'cancelled'] as const;

    for (const status of statuses) {
      const row = store.create({
        correlationId: `corr-valid-${status}`,
        actionType: 'file_write',
        actionSummary: 'test',
        riskLevel: 'HIGH',
        riskScore: 80,
        riskFactors: [],
      });
      const resolved = store.resolve(row.id, status);
      expect(resolved.status).toBe(status);
    }
  });
});

// ══════════════════════════════════════════════════
// Scenario 3: 전체 흐름 (요청 → 알림 → 응답)
// ══════════════════════════════════════════════════
describe('Scenario 3: Full confirmation flow', () => {
  it('should create confirmation, notify, and handle approval', async () => {
    const channel = mockChannel('telegram');
    bus.on('confirmation_requested', () => {});
    bus.on('confirmation_resolved', () => {});

    const manager = new ConfirmationManager({
      storage: asStorage(storage),
      eventBus: bus,
      channels: [channel],
      timeoutSeconds: 10,
    });

    const promise = manager.requestConfirmation(
      {
        agentId: 'test',
        actionType: 'file_write',
        target: 'src/auth/login.ts',
        params: {},
      },
      { riskLevel: 'HIGH', score: 80, factors: ['Sensitive file'], reasoning: 'test' },
    );

    // Simulate owner approval after short delay
    await new Promise((r) => { setTimeout(r, 50); });
    const pending = manager.getStore().getPending();
    expect(pending.length).toBe(1);

    manager.handleResponse(pending[0].id, true, 'Approved by owner');

    const result = await promise;
    expect(result.status).toBe('approved');
    expect(result.response).toBe('Approved by owner');
  });

  it('should create confirmation, notify, and handle rejection', async () => {
    const channel = mockChannel('slack');
    bus.on('confirmation_requested', () => {});
    bus.on('confirmation_resolved', () => {});

    const manager = new ConfirmationManager({
      storage: asStorage(storage),
      eventBus: bus,
      channels: [channel],
      timeoutSeconds: 10,
    });

    const promise = manager.requestConfirmation(
      {
        agentId: 'test',
        actionType: 'bash_exec',
        target: 'rm -rf /data',
        params: {},
      },
      { riskLevel: 'HIGH', score: 85, factors: ['Dangerous command'], reasoning: 'test' },
    );

    await new Promise((r) => { setTimeout(r, 50); });
    const pending = manager.getStore().getPending();
    manager.handleResponse(pending[0].id, false, 'Too risky');

    const result = await promise;
    expect(result.status).toBe('rejected');
    manager.stopExpiryCheck();
  });
});

// ══════════════════════════════════════════════════
// Scenario 4: 타임아웃 자동 만료
// ══════════════════════════════════════════════════
describe('Scenario 4: Timeout expiry', () => {
  it('should expire confirmations after timeout', () => {
    const store = new ConfirmationStore(asStorage(storage));
    store.create({
      correlationId: 'corr-expire',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
      timeoutSeconds: 1,
    });

    // Manually set expiresAt to past
    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): { run(...args: unknown[]): void };
    };
    db.prepare("UPDATE confirmations SET expiresAt = '2020-01-01T00:00:00Z' WHERE status = 'pending'").run();

    const expired = store.getExpired();
    expect(expired.length).toBe(1);

    store.resolve(expired[0].id, 'expired', 'Timeout');
    const updated = store.getById(expired[0].id);
    expect(updated!.status).toBe('expired');
  });

  it('should batch process expired via checkExpired', () => {
    bus.on('confirmation_resolved', () => {});

    const manager = new ConfirmationManager({
      storage: asStorage(storage),
      eventBus: bus,
      channels: [mockChannel('test')],
      timeoutSeconds: 1,
    });

    const store = manager.getStore();
    store.create({
      correlationId: 'corr-batch-1',
      actionType: 'file_write',
      actionSummary: 'test1',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });
    store.create({
      correlationId: 'corr-batch-2',
      actionType: 'file_write',
      actionSummary: 'test2',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });

    // Set both to expired
    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): { run(...args: unknown[]): void };
    };
    db.prepare("UPDATE confirmations SET expiresAt = '2020-01-01T00:00:00Z' WHERE status = 'pending'").run();

    const count = manager.checkExpired();
    expect(count).toBe(2);
    expect(manager.getPendingCount()).toBe(0);
    manager.stopExpiryCheck();
  });
});

// ══════════════════════════════════════════════════
// Scenario 5: 알림 채널 Fallback
// ══════════════════════════════════════════════════
describe('Scenario 5: Channel fallback', () => {
  it('should fallback to next channel on failure', async () => {
    const telegram = failChannel('telegram');
    const slack = mockChannel('slack');
    const dispatcher = new NotificationDispatcher([telegram, slack]);

    const result = await dispatcher.notify({
      id: 'test-1',
      actionType: 'file_write',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: '["test"]',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    } as ConfirmationRow);

    expect(result.success).toBe(true);
    expect(result.channel).toBe('slack');
    expect(telegram.send).toHaveBeenCalled();
    expect(slack.send).toHaveBeenCalled();
  });

  it('should use first successful channel', async () => {
    const telegram = mockChannel('telegram');
    const slack = mockChannel('slack');
    const dispatcher = new NotificationDispatcher([telegram, slack]);

    const result = await dispatcher.notify({
      id: 'test-2',
      actionType: 'file_write',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: '["test"]',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    } as ConfirmationRow);

    expect(result.success).toBe(true);
    expect(result.channel).toBe('telegram');
    expect(slack.send).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════
// Scenario 6: 모든 채널 실패 시 차단
// ══════════════════════════════════════════════════
describe('Scenario 6: All channels fail (fail-closed)', () => {
  it('should return failure when all channels fail', async () => {
    const dispatcher = new NotificationDispatcher([
      failChannel('telegram'),
      failChannel('slack'),
    ]);

    const result = await dispatcher.notify({
      id: 'test-fail',
      actionType: 'file_write',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: '["test"]',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    } as ConfirmationRow);

    expect(result.success).toBe(false);
    expect(result.channel).toBeNull();
    expect(result.error).toContain('All notification channels failed');
  });

  it('should expire confirmation when all channels fail (via manager)', async () => {
    bus.on('confirmation_resolved', () => {});

    const manager = new ConfirmationManager({
      storage: asStorage(storage),
      eventBus: bus,
      channels: [failChannel('telegram'), failChannel('slack')],
      timeoutSeconds: 60,
    });

    const result = await manager.requestConfirmation(
      { agentId: 'test', actionType: 'file_write', target: 'src/test.ts', params: {} },
      { riskLevel: 'HIGH', score: 80, factors: ['test'], reasoning: 'test' },
    );

    expect(result.status).toBe('expired');
    manager.stopExpiryCheck();
  });
});

// ══════════════════════════════════════════════════
// Scenario 7: Idempotency Key
// ══════════════════════════════════════════════════
describe('Scenario 7: Idempotency key', () => {
  it('should return existing confirmation for duplicate idempotencyKey', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const first = store.create({
      correlationId: 'corr-idem',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
      idempotencyKey: 'key-001',
    });

    const second = store.create({
      correlationId: 'corr-idem-2',
      actionType: 'file_write',
      actionSummary: 'test-different',
      riskLevel: 'HIGH',
      riskScore: 90,
      riskFactors: [],
      idempotencyKey: 'key-001',
    });

    expect(second.id).toBe(first.id);
    expect(second.correlationId).toBe('corr-idem');
  });

  it('should create new confirmation with different idempotencyKey', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const first = store.create({
      correlationId: 'corr-a',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
      idempotencyKey: 'key-A',
    });

    const second = store.create({
      correlationId: 'corr-b',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
      idempotencyKey: 'key-B',
    });

    expect(second.id).not.toBe(first.id);
  });
});

// ══════════════════════════════════════════════════
// Scenario 8: 동시 응답 Race Condition 방지
// ══════════════════════════════════════════════════
describe('Scenario 8: Race condition prevention', () => {
  it('should only allow one resolution via SQLite transaction', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-race',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });

    // First resolve succeeds
    const resolved = store.resolve(row.id, 'approved', 'First');
    expect(resolved.status).toBe('approved');

    // Second resolve fails
    expect(() => {
      store.resolve(row.id, 'rejected', 'Second');
    }).toThrow(InvalidTransitionError);
  });

  it('should handle concurrent resolve attempts', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-concurrent',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });

    const results: Array<{ status: string } | { error: string }> = [];

    // Simulate concurrent access
    try {
      results.push(store.resolve(row.id, 'approved', 'Approve'));
    } catch (e) {
      results.push({ error: (e as Error).message });
    }
    try {
      results.push(store.resolve(row.id, 'rejected', 'Reject'));
    } catch (e) {
      results.push({ error: (e as Error).message });
    }

    const successes = results.filter((r) => 'status' in r);
    const failures = results.filter((r) => 'error' in r);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════
// Notification message format
// ══════════════════════════════════════════════════
describe('Notification message format', () => {
  it('should format message correctly', () => {
    const dispatcher = new NotificationDispatcher([]);
    const message = dispatcher.formatMessage({
      id: 'test-msg',
      actionType: 'file_write',
      actionSummary: 'Write to src/auth/login.ts',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: '["Sensitive file","Auth directory"]',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    } as ConfirmationRow);

    expect(message).toContain('Security Sentinel');
    expect(message).toContain('file_write');
    expect(message).toContain('HIGH');
    expect(message).toContain('80/100');
    expect(message).toContain('Sensitive file');
    expect(message).toContain('[Approve]');
    expect(message).toContain('[Reject]');
  });
});

// ══════════════════════════════════════════════════
// ConfirmationStore queries
// ══════════════════════════════════════════════════
describe('ConfirmationStore queries', () => {
  it('should get by correlation', () => {
    const store = new ConfirmationStore(asStorage(storage));
    store.create({
      correlationId: 'corr-query',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });

    const results = store.getByCorrelation('corr-query');
    expect(results.length).toBe(1);
    expect(results[0].correlationId).toBe('corr-query');
  });

  it('should update channel', () => {
    const store = new ConfirmationStore(asStorage(storage));
    const row = store.create({
      correlationId: 'corr-chan',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
    });

    store.updateChannel(row.id, 'telegram');
    const updated = store.getById(row.id);
    expect(updated!.channel).toBe('telegram');
    expect(updated!.notifiedAt).toBeDefined();
  });
});

// ══════════════════════════════════════════════════
// ConfirmationManager startup recovery
// ══════════════════════════════════════════════════
describe('ConfirmationManager startup recovery', () => {
  it('should expire old pending confirmations on startup', () => {
    const store = new ConfirmationStore(asStorage(storage));
    store.create({
      correlationId: 'corr-old',
      actionType: 'file_write',
      actionSummary: 'test',
      riskLevel: 'HIGH',
      riskScore: 80,
      riskFactors: [],
      timeoutSeconds: 1,
    });

    // Set to past
    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): { run(...args: unknown[]): void };
    };
    db.prepare("UPDATE confirmations SET expiresAt = '2020-01-01T00:00:00Z' WHERE status = 'pending'").run();

    const manager = new ConfirmationManager({
      storage: asStorage(storage),
      eventBus: bus,
      channels: [],
    });
    manager.loadPendingOnStartup();

    expect(manager.getPendingCount()).toBe(0);
    manager.stopExpiryCheck();
  });
});

// ══════════════════════════════════════════════════
// Phase 3 module exports
// ══════════════════════════════════════════════════
describe('Phase 3 module exports', () => {
  it('should export all Phase 3 classes', async () => {
    const mod = await import('../index.js');
    expect(mod.ConfirmationStore).toBeDefined();
    expect(mod.ConfirmationManager).toBeDefined();
    expect(mod.NotificationDispatcher).toBeDefined();
    expect(mod.InvalidTransitionError).toBeDefined();
  });
});
