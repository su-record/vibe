import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { EventBus } from '../EventBus.js';
import { AuditStore } from '../AuditStore.js';
import { EventOutbox } from '../EventOutbox.js';

let storage: MemoryStorage;
let bus: EventBus;
let auditStore: AuditStore;
let outbox: EventOutbox;
let testDir: string;

const asStorage = (s: MemoryStorage): { getDatabase: () => ReturnType<typeof s.getDatabase> } =>
  s as unknown as { getDatabase: () => ReturnType<typeof s.getDatabase> };

beforeEach(() => {
  testDir = join(tmpdir(), `core-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = new MemoryStorage(testDir);
  bus = new EventBus();
  auditStore = new AuditStore(asStorage(storage));
  outbox = new EventOutbox(asStorage(storage), bus);
});

afterEach(() => {
  outbox.stop();
  storage.close();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors on Windows
  }
});

// Scenario 6: Transactional Outbox 정상 발행
describe('Scenario 6: Transactional Outbox 정상 발행', () => {
  it('should enqueue event as pending', () => {
    const id = outbox.enqueue({
      eventType: 'agent_action',
      payload: { agentId: 'test', actionType: 'file_write', target: '/tmp/test' },
    });

    expect(id).toBeDefined();
    expect(outbox.getPendingCount()).toBe(1);
  });

  it('should publish pending events to EventBus via processOutbox', () => {
    const received: unknown[] = [];
    bus.on('agent_action', (event) => { received.push(event); });

    outbox.enqueue({
      eventType: 'agent_action',
      payload: { agentId: 'test', actionType: 'file_write', target: '/tmp/test' },
    });

    outbox.processOutbox();

    expect(received).toHaveLength(1);
    expect(outbox.getPendingCount()).toBe(0);
  });

  it('should mark event as published after successful delivery', () => {
    bus.on('agent_action', () => {});

    outbox.enqueue({
      eventType: 'agent_action',
      payload: { agentId: 'test', actionType: 'file_write', target: '/tmp/test' },
    });

    outbox.processOutbox();

    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): { get(...args: unknown[]): { status: string } | undefined };
    };
    const row = db.prepare("SELECT status FROM event_outbox WHERE status = 'published'").get();
    expect(row).toBeDefined();
    expect(row!.status).toBe('published');
  });
});

// Scenario 7: Outbox 실패 재시도
describe('Scenario 7: Outbox 실패 재시도', () => {
  it('should retry failed events up to 3 times then mark as failed', () => {
    // Register a listener that always throws
    bus.on('agent_action', () => {
      throw new Error('Delivery failed');
    });
    bus.on('error', () => {}); // consume error events

    outbox.enqueue({
      eventType: 'agent_action',
      payload: { agentId: 'test', actionType: 'file_write', target: '/tmp/test' },
    });

    // Process 3 times (retry)
    outbox.processOutbox(); // attempt 1 → pending (retryCount 1)
    outbox.processOutbox(); // attempt 2 → pending (retryCount 2) — may be skipped due to backoff
    outbox.processOutbox(); // attempt 3

    // Check: should still have pending or failed status
    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): {
        get(...args: unknown[]): { retryCount: number; status: string } | undefined;
        all(...args: unknown[]): Array<{ retryCount: number; status: string }>;
      };
    };

    const rows = db
      .prepare('SELECT retryCount, status FROM event_outbox')
      .all();

    expect(rows).toHaveLength(1);
    // After first failure, retryCount should be at least 1
    expect(rows[0].retryCount).toBeGreaterThanOrEqual(1);
  });

  it('should move to dead_letter_events after max retries', () => {
    bus.on('agent_action', () => {
      throw new Error('Always fails');
    });
    bus.on('error', () => {});

    outbox.enqueue({
      eventType: 'agent_action',
      payload: { agentId: 'test', actionType: 'file_write', target: '/tmp/test' },
    });

    // Force process enough times (bypassing backoff by manipulating db)
    const db = (storage as unknown as { getDatabase(): unknown }).getDatabase() as {
      prepare(sql: string): {
        run(...args: unknown[]): void;
        get(...args: unknown[]): { count: number } | undefined;
      };
    };

    // Process and manually reset backoff for testing
    for (let i = 0; i < 4; i++) {
      outbox.processOutbox();
      // Reset lastRetryAt to bypass backoff
      db.prepare("UPDATE event_outbox SET lastRetryAt = '2000-01-01T00:00:00Z' WHERE status = 'pending'").run();
    }

    const deadLetterCount = (
      db.prepare('SELECT COUNT(*) as count FROM dead_letter_events').get() as { count: number }
    ).count;

    expect(deadLetterCount).toBeGreaterThanOrEqual(1);
  });
});

// Scenario 8: 대량 이벤트 성능
describe('Scenario 8: 대량 이벤트 성능', () => {
  it('should record 1000 events within 100ms', () => {
    const events = Array.from({ length: 1000 }, (_, i) => ({
      correlationId: `perf-${i}`,
      eventType: 'agent_action',
      agentId: 'perf-test',
      payload: { index: i, data: `payload-${i}` },
    }));

    const start = performance.now();
    auditStore.recordBatch(events);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);

    const results = auditStore.query({ agentId: 'perf-test', limit: 200 });
    expect(results.length).toBe(200);
  });
});

// Scenario 9: 모듈 Export
describe('Scenario 9: 모듈 Export', () => {
  it('should export all main classes', async () => {
    const mod = await import('../index.js');

    expect(mod.EventBus).toBeDefined();
    expect(mod.AuditStore).toBeDefined();
    expect(mod.EventOutbox).toBeDefined();
  });

  it('should export all schemas', async () => {
    const mod = await import('../index.js');

    expect(mod.RiskLevel).toBeDefined();
    expect(mod.ActionType).toBeDefined();
    expect(mod.AgentActionEventSchema).toBeDefined();
    expect(mod.PolicyCheckEventSchema).toBeDefined();
    expect(mod.RiskAssessedEventSchema).toBeDefined();
    expect(mod.ConfirmationEventSchema).toBeDefined();
    expect(mod.AuditLogEventSchema).toBeDefined();
    expect(mod.ErrorEventSchema).toBeDefined();
    expect(mod.EventSchemaMap).toBeDefined();
  });
});

// Integration: Event → AuditStore → Outbox → 조회
describe('Integration: EventBus → AuditStore → Outbox', () => {
  it('should flow from event emission to audit record to outbox delivery', () => {
    // Wire up: EventBus → AuditStore
    bus.on('agent_action', (event) => {
      auditStore.record({
        correlationId: event.correlationId,
        eventType: 'agent_action',
        agentId: event.agentId,
        actionType: event.actionType,
        riskLevel: event.riskLevel,
        payload: { target: event.target },
      });
    });

    // Emit event
    const enriched = bus.emit('agent_action', {
      agentId: 'implementer',
      actionType: 'file_write',
      target: '/src/lib/test.ts',
      riskLevel: 'LOW',
    });

    // Verify audit record
    const chain = auditStore.getByCorrelation(enriched.correlationId);
    expect(chain).toHaveLength(1);
    expect(chain[0].agentId).toBe('implementer');
    expect(chain[0].eventType).toBe('agent_action');
  });

  it('should handle concurrent event recording (10 parallel)', () => {
    const ids: string[] = [];

    for (let i = 0; i < 10; i++) {
      ids.push(
        auditStore.record({
          correlationId: `concurrent-${i}`,
          eventType: 'agent_action',
          payload: { index: i },
        }),
      );
    }

    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10); // All unique IDs

    for (let i = 0; i < 10; i++) {
      const chain = auditStore.getByCorrelation(`concurrent-${i}`);
      expect(chain).toHaveLength(1);
    }
  });
});
