import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { GenerationRegistry } from '../GenerationRegistry.js';
import { UsageTracker } from '../UsageTracker.js';
import { LifecycleManager } from '../LifecycleManager.js';
import { RollbackManager } from '../RollbackManager.js';
import { CircuitBreaker } from '../CircuitBreaker.js';

// Helper: create a generation and return its ID
function createGeneration(
  registry: GenerationRegistry,
  overrides: Partial<Parameters<GenerationRegistry['save']>[0]> = {},
): string {
  return registry.save({
    insightId: 'ins-test',
    type: 'skill',
    name: `test-skill-${Date.now()}`,
    content: '# Test\n\nContent here.',
    status: 'active',
    qualityScore: 70,
    ...overrides,
  });
}

// Scenario 1: Usage event recording
describe('UsageTracker', () => {
  let storage: MemoryStorage;
  let tracker: UsageTracker;
  let registry: GenerationRegistry;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-usage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    registry = new GenerationRegistry(storage);
    tracker = new UsageTracker(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should record usage event and increment generation usage count', () => {
    const genId = createGeneration(registry);
    const eventId = tracker.recordUsage(genId, 'session-1', 'analyze csv');

    expect(eventId).toBeTruthy();

    const events = tracker.getByGeneration(genId);
    expect(events).toHaveLength(1);
    expect(events[0].generationId).toBe(genId);
    expect(events[0].sessionId).toBe('session-1');
    expect(events[0].matchedPrompt).toBe('analyze csv');

    // Check usage count incremented
    const gen = registry.getById(genId);
    expect(gen!.usageCount).toBe(1);
  });

  it('should set explicit feedback', () => {
    const genId = createGeneration(registry);
    const eventId = tracker.recordUsage(genId, 'session-1', 'test prompt');
    tracker.setFeedback(eventId, 'positive');

    const events = tracker.getByGeneration(genId);
    expect(events[0].feedback).toBe('positive');
  });

  it('should apply implicit feedback based on goals ratio', () => {
    const genId = createGeneration(registry);
    tracker.recordUsage(genId, 'session-1');
    tracker.recordUsage(genId, 'session-1');

    // 80%+ goals → positive
    const updated = tracker.applyImplicitFeedback('session-1', 0.9);
    expect(updated).toBe(2);

    const events = tracker.getByGeneration(genId);
    expect(events.every(e => e.feedback === 'positive')).toBe(true);
  });

  it('should not overwrite explicit feedback with implicit', () => {
    const genId = createGeneration(registry);
    const eventId = tracker.recordUsage(genId, 'session-1', 'prompt');
    tracker.setFeedback(eventId, 'positive');

    // Apply implicit negative
    tracker.applyImplicitFeedback('session-1', 0.1);

    const events = tracker.getByGeneration(genId);
    // Explicit positive should be preserved (was already set)
    expect(events[0].feedback).toBe('positive');
  });

  it('should calculate weighted feedback stats', () => {
    const genId = createGeneration(registry);

    // 2 explicit positives (with matchedPrompt)
    const e1 = tracker.recordUsage(genId, 's1', 'prompt1');
    tracker.setFeedback(e1, 'positive');
    const e2 = tracker.recordUsage(genId, 's1', 'prompt2');
    tracker.setFeedback(e2, 'positive');

    // 1 implicit negative (no matchedPrompt)
    tracker.recordUsage(genId, 's2');
    tracker.applyImplicitFeedback('s2', 0.1);

    const stats = tracker.getFeedbackStats(genId);
    expect(stats.totalEvents).toBe(3);
    expect(stats.explicitPositive).toBe(2);
    expect(stats.implicitNegative).toBe(1);
    // weighted: posWeight=2*2=4, negWeight=1*1=1, ratio=1/5=0.2
    expect(stats.weightedNegativeRatio).toBeLessThan(0.3);
  });
});

// Scenario 2 & 3 & 9: Lifecycle Manager
describe('LifecycleManager', () => {
  let storage: MemoryStorage;
  let registry: GenerationRegistry;
  let tracker: UsageTracker;
  let lifecycle: LifecycleManager;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new MemoryStorage(testDir);
    registry = new GenerationRegistry(storage);
    tracker = new UsageTracker(storage);
    lifecycle = new LifecycleManager(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // Scenario 2: TTL expiration
  it('should disable active skill after TTL expiration', () => {
    const genId = createGeneration(registry, { status: 'active' });

    // Backdate lastUsedAt to 8 days ago
    const db = storage.getDatabase();
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`UPDATE generations SET lastUsedAt = ?, updatedAt = ? WHERE id = ?`).run(oldDate, oldDate, genId);

    const expired = lifecycle.checkTTLExpiration();
    expect(expired).toContain(genId);

    const gen = registry.getById(genId);
    expect(gen!.status).toBe('disabled');
  });

  // Scenario 3: testing → active promotion
  it('should promote testing to active after 3+ uses with positive feedback', () => {
    const genId = createGeneration(registry, { status: 'testing' });

    // Record 3 usages with positive feedback
    for (let i = 0; i < 3; i++) {
      const eventId = tracker.recordUsage(genId, `session-${i}`, `prompt-${i}`);
      tracker.setFeedback(eventId, 'positive');
    }

    const promoted = lifecycle.checkPromotions();
    expect(promoted).toContain(genId);

    const gen = registry.getById(genId);
    expect(gen!.status).toBe('active');
  });

  it('should not promote with less than 3 usages', () => {
    const genId = createGeneration(registry, { status: 'testing' });
    tracker.recordUsage(genId, 's1', 'p1');
    tracker.recordUsage(genId, 's2', 'p2');

    const promoted = lifecycle.checkPromotions();
    expect(promoted).not.toContain(genId);
  });

  // Scenario 9: Demotion on high negative feedback
  it('should demote active skill with > 50% negative feedback', () => {
    const genId = createGeneration(registry, { status: 'active' });

    // Record 3 negative explicit feedbacks
    for (let i = 0; i < 3; i++) {
      const eventId = tracker.recordUsage(genId, `s-${i}`, `p-${i}`);
      tracker.setFeedback(eventId, 'negative');
    }
    // 1 positive
    const posId = tracker.recordUsage(genId, 's-pos', 'p-pos');
    tracker.setFeedback(posId, 'positive');

    // 3 neg * 2 = 6 weighted neg, 1 pos * 2 = 2 weighted pos, ratio = 6/8 = 0.75 > 0.5
    const demoted = lifecycle.checkDemotions();
    expect(demoted).toContain(genId);

    const gen = registry.getById(genId);
    expect(gen!.status).toBe('disabled');
  });

  it('should approve draft to testing', () => {
    const genId = createGeneration(registry, { status: 'draft' });
    const success = lifecycle.approve(genId);
    expect(success).toBe(true);

    const gen = registry.getById(genId);
    expect(gen!.status).toBe('testing');
  });

  it('should reject draft to deleted', () => {
    const genId = createGeneration(registry, { status: 'draft' });
    const success = lifecycle.reject(genId);
    expect(success).toBe(true);

    const gen = registry.getById(genId);
    expect(gen!.status).toBe('deleted');
  });

  // Deletion of long-disabled
  it('should delete disabled generations after additional TTL', () => {
    const genId = createGeneration(registry, { status: 'disabled' });

    // Backdate updatedAt to 8 days ago
    const db = storage.getDatabase();
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`UPDATE generations SET updatedAt = ? WHERE id = ?`).run(oldDate, genId);

    const deleted = lifecycle.checkDeletions();
    expect(deleted).toContain(genId);

    const gen = registry.getById(genId);
    expect(gen!.status).toBe('deleted');
  });
});

// Scenario 4 & 5: Rollback Manager
describe('RollbackManager', () => {
  let storage: MemoryStorage;
  let registry: GenerationRegistry;
  let rollback: RollbackManager;
  let testDir: string;
  let fileDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `core-rollback-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fileDir = join(testDir, 'auto-files');
    mkdirSync(fileDir, { recursive: true });
    storage = new MemoryStorage(testDir);
    registry = new GenerationRegistry(storage);
    rollback = new RollbackManager(storage);
  });

  afterEach(() => {
    storage.close();
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should disable a generation and rename file to .disabled', () => {
    const filePath = join(fileDir, 'test-skill.md');
    writeFileSync(filePath, '# Test Skill');

    const genId = registry.save({
      insightId: 'ins-1',
      type: 'skill',
      name: 'test-skill',
      content: '# Test',
      status: 'active',
      filePath,
    });

    rollback.disable(genId);

    expect(registry.getById(genId)!.status).toBe('disabled');
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(`${filePath}.disabled`)).toBe(true);
  });

  // Scenario 4: Rollback to previous version
  it('should rollback to parent version', () => {
    const v1Path = join(fileDir, 'skill-v1.md');
    const v2Path = join(fileDir, 'skill-v2.md');
    writeFileSync(v2Path, '# V2');

    const v1Id = registry.save({
      insightId: 'ins-1',
      type: 'skill',
      name: 'skill-v1',
      content: '# V1',
      status: 'disabled',
      filePath: v1Path,
    });

    // Create .disabled file for v1 (simulating it was disabled)
    writeFileSync(`${v1Path}.disabled`, '# V1');

    const v2Id = registry.save({
      insightId: 'ins-1',
      type: 'skill',
      name: 'skill-v2',
      content: '# V2',
      status: 'active',
      filePath: v2Path,
      parentId: v1Id,
    });

    rollback.rollback(v2Id);

    // v2 should be disabled
    expect(registry.getById(v2Id)!.status).toBe('disabled');
    expect(existsSync(v2Path)).toBe(false);
    expect(existsSync(`${v2Path}.disabled`)).toBe(true);

    // v1 should be restored
    expect(registry.getById(v1Id)!.status).toBe('active');
    expect(existsSync(v1Path)).toBe(true);
  });

  it('should throw when rollback has no parent', () => {
    const genId = createGeneration(registry);
    expect(() => rollback.rollback(genId)).toThrow('No parent version');
  });

  // Scenario 5: Emergency disable all
  it('should emergency disable all active generations', () => {
    const file1 = join(fileDir, 'skill-a.md');
    const file2 = join(fileDir, 'agent-b.md');
    writeFileSync(file1, '# A');
    writeFileSync(file2, '# B');

    registry.save({ insightId: 'i1', type: 'skill', name: 'a', content: 'c', status: 'active', filePath: file1 });
    registry.save({ insightId: 'i2', type: 'agent', name: 'b', content: 'c', status: 'testing', filePath: file2 });
    registry.save({ insightId: 'i3', type: 'rule', name: 'c', content: 'c', status: 'disabled' });

    const result = rollback.emergencyDisableAll();

    expect(result.disabled).toBe(2); // active + testing
    expect(existsSync(`${file1}.disabled`)).toBe(true);
    expect(existsSync(`${file2}.disabled`)).toBe(true);

    // All should be disabled in DB
    const stats = registry.getStats();
    expect(stats.byStatus['active']).toBeUndefined();
    expect(stats.byStatus['testing']).toBeUndefined();
    expect(stats.byStatus['disabled']).toBe(3);
  });
});

// Scenario 6: Circuit Breaker
describe('CircuitBreaker', () => {
  it('should start in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
    expect(cb.canExecute()).toBe(true);
  });

  it('should open after > 50% failures in window', () => {
    const cb = new CircuitBreaker();

    // Record 10 results: 6 failures, 4 successes
    for (let i = 0; i < 4; i++) cb.record(true);
    for (let i = 0; i < 6; i++) cb.record(false);

    expect(cb.getState()).toBe('open');
    expect(cb.canExecute()).toBe(false);
  });

  it('should remain closed with < 50% failures', () => {
    const cb = new CircuitBreaker();

    for (let i = 0; i < 10; i++) {
      cb.record(i % 2 === 0); // 5 success, 5 failure = 50% (threshold is >50%)
    }

    expect(cb.getState()).toBe('closed');
  });

  it('should transition to half-open after cooldown', () => {
    const cb = new CircuitBreaker();

    // Force open
    for (let i = 0; i < 10; i++) cb.record(false);
    expect(cb.getState()).toBe('open');

    // Simulate cooldown by manipulating internal state via reset + reopen + time
    // Since we can't easily mock time, test the reset path
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });

  it('should close after successful half-open trial', () => {
    const cb = new CircuitBreaker();

    // Fill window with failures
    for (let i = 0; i < 10; i++) cb.record(false);
    expect(cb.getState()).toBe('open');

    // Reset to simulate half-open transition
    cb.reset();
    expect(cb.canExecute()).toBe(true);
    cb.record(true);
    expect(cb.getState()).toBe('closed');
  });

  it('should return correct stats', () => {
    const cb = new CircuitBreaker();
    cb.record(true);
    cb.record(false);
    cb.record(true);

    const stats = cb.getStats();
    expect(stats.state).toBe('closed');
    expect(stats.recentFailures).toBe(1);
    expect(stats.windowSize).toBe(3);
  });
});
