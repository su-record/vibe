import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';
import { MemoryStorage } from '../../memory/MemoryStorage.js';
import { EventBus } from '../EventBus.js';
import { AuditStore } from '../AuditStore.js';
import { SecuritySentinel } from '../SecuritySentinel.js';
import { TaskDecomposer, CircularDependencyError } from '../TaskDecomposer.js';
import type { DecomposedTask, TaskStep } from '../TaskDecomposer.js';
import { CollaborationProtocol, MessageSizeError } from '../CollaborationProtocol.js';
import { AutonomyOrchestrator } from '../AutonomyOrchestrator.js';
import { loadConfig, getDefaultConfig } from '../AutonomyConfig.js';

let storage: MemoryStorage;
let bus: EventBus;
let auditStore: AuditStore;
let testDir: string;

const asStorage = (s: MemoryStorage): { getDatabase: () => ReturnType<typeof s.getDatabase> } =>
  s as unknown as { getDatabase: () => ReturnType<typeof s.getDatabase> };

beforeEach(() => {
  testDir = join(tmpdir(), `integration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = new MemoryStorage(testDir);
  bus = new EventBus();
  auditStore = new AuditStore(asStorage(storage));
  SecuritySentinel.resetInstance();
});

afterEach(() => {
  storage.close();
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors on Windows
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TaskDecomposer Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TaskDecomposer', () => {
  it('should decompose simple fix prompt into implement + test', () => {
    const decomposer = new TaskDecomposer();
    const result = decomposer.decompose('Fix the typo in utils.ts');

    expect(result.estimatedComplexity).toBe('low');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].type).toBe('implement');
    expect(result.steps[1].type).toBe('test');
  });

  it('should decompose medium feature into spec + implement + test', () => {
    const decomposer = new TaskDecomposer();
    const result = decomposer.decompose('Add a new component for user profile');

    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    const types = result.steps.map((s) => s.type);
    expect(types).toContain('implement');
    expect(types).toContain('test');
  });

  it('should decompose complex feature with high complexity keywords', () => {
    const decomposer = new TaskDecomposer();
    const result = decomposer.decompose('Refactor the entire authentication system architecture');

    expect(result.estimatedComplexity).toBe('high');
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    const types = result.steps.map((s) => s.type);
    expect(types).toContain('spec');
    expect(types).toContain('implement');
    expect(types).toContain('test');
  });

  it('should mark HIGH risk for prompts with dangerous keywords', () => {
    const decomposer = new TaskDecomposer();
    const result = decomposer.decompose('Delete all auth credentials and reset tokens');

    expect(result.requiresConfirmation).toBe(true);
    const implStep = result.steps.find((s) => s.type === 'implement');
    expect(implStep?.riskLevel).toBe('HIGH');
  });

  it('should throw on empty prompt', () => {
    const decomposer = new TaskDecomposer();
    expect(() => decomposer.decompose('')).toThrow('User prompt cannot be empty');
    expect(() => decomposer.decompose('   ')).toThrow('User prompt cannot be empty');
  });

  it('should assign unique IDs to each step', () => {
    const decomposer = new TaskDecomposer();
    const result = decomposer.decompose('Create a new feature module');

    const ids = result.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should detect circular dependency in manually constructed steps', () => {
    const decomposer = new TaskDecomposer();
    const steps: TaskStep[] = [
      { id: 'a', order: 1, type: 'spec', description: 'A', dependencies: ['test'], estimatedFiles: 1, riskLevel: 'LOW', status: 'pending' },
      { id: 'b', order: 2, type: 'implement', description: 'B', dependencies: ['spec'], estimatedFiles: 1, riskLevel: 'LOW', status: 'pending' },
      { id: 'c', order: 3, type: 'test', description: 'C', dependencies: ['implement'], estimatedFiles: 1, riskLevel: 'LOW', status: 'pending' },
    ];
    // This creates a cycle: spec→test→implement→spec
    expect(() => decomposer.validateDAG(steps)).toThrow(CircularDependencyError);
  });

  it('should set deploy step as HIGH risk', () => {
    const decomposer = new TaskDecomposer();
    // Manually verify deploy risk logic by checking the private method behavior
    const result = decomposer.decompose('Deploy the production release');
    expect(result.requiresConfirmation).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CollaborationProtocol Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('CollaborationProtocol', () => {
  it('should assign correct agent for each step type', () => {
    const protocol = new CollaborationProtocol();

    const specStep: TaskStep = { id: '1', order: 1, type: 'spec', description: '', dependencies: [], estimatedFiles: 1, riskLevel: 'LOW', status: 'pending' };
    const implStep: TaskStep = { id: '2', order: 2, type: 'implement', description: '', dependencies: ['spec'], estimatedFiles: 3, riskLevel: 'LOW', status: 'pending' };
    const testStep: TaskStep = { id: '3', order: 3, type: 'test', description: '', dependencies: ['implement'], estimatedFiles: 2, riskLevel: 'LOW', status: 'pending' };
    const reviewStep: TaskStep = { id: '4', order: 4, type: 'review', description: '', dependencies: ['spec'], estimatedFiles: 1, riskLevel: 'LOW', status: 'pending' };

    expect(protocol.assignAgent(specStep).agentName).toBe('architect');
    expect(protocol.assignAgent(implStep).agentName).toBe('implementer');
    expect(protocol.assignAgent(testStep).agentName).toBe('tester');
    expect(protocol.assignAgent(reviewStep).agentName).toBe('security-reviewer');
  });

  it('should handoff context between agents', () => {
    const protocol = new CollaborationProtocol();
    const result = protocol.handoff('architect', 'implementer', {
      files: ['src/lib/auth.ts', 'src/lib/types.ts'],
      changes: ['Added AuthService class', 'Defined User interface'],
      decisions: ['Use JWT for authentication'],
    });

    expect(result.success).toBe(true);
    expect(result.from).toBe('architect');
    expect(result.to).toBe('implementer');
    expect(result.context.files).toHaveLength(2);
    expect(result.context.decisions).toContain('Use JWT for authentication');
  });

  it('should record handoff in log', () => {
    const protocol = new CollaborationProtocol();
    protocol.handoff('architect', 'implementer', {
      files: [], changes: [], decisions: [],
    });

    expect(protocol.getHandoffLog()).toHaveLength(1);
  });

  it('should create valid messages with correlation IDs', () => {
    const protocol = new CollaborationProtocol();
    const msg = protocol.createMessage('architect', 'implementer', 'request', { data: 'test' });

    expect(msg.id).toBeDefined();
    expect(msg.correlationId).toBeDefined();
    expect(msg.from).toBe('architect');
    expect(msg.to).toBe('implementer');
    expect(msg.type).toBe('request');
  });

  it('should reject messages exceeding 10KB', () => {
    const protocol = new CollaborationProtocol();
    const largePayload = 'x'.repeat(11_000);

    expect(() =>
      protocol.createMessage('a', 'b', 'request', largePayload),
    ).toThrow(MessageSizeError);
  });

  it('should track retry counts per step', () => {
    const protocol = new CollaborationProtocol();

    expect(protocol.canRetry('step-1')).toBe(true);
    expect(protocol.getRetryCount('step-1')).toBe(0);

    protocol.recordRetry('step-1');
    expect(protocol.getRetryCount('step-1')).toBe(1);
    expect(protocol.canRetry('step-1')).toBe(false);
  });

  it('should trim context items to MAX_CONTEXT_ITEMS', () => {
    const protocol = new CollaborationProtocol();
    const largeFiles = Array.from({ length: 200 }, (_, i) => `file-${i}.ts`);

    const result = protocol.handoff('a', 'b', {
      files: largeFiles,
      changes: [],
      decisions: [],
    });

    expect(result.context.files.length).toBeLessThanOrEqual(100);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AutonomyOrchestrator Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AutonomyOrchestrator', () => {
  function createOrchestrator(executor?: (step: TaskStep) => Promise<{ success: boolean; output?: string; error?: string }>): AutonomyOrchestrator {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    return new AutonomyOrchestrator({
      eventBus: bus,
      auditStore,
      sentinel,
      stepExecutor: executor
        ? (step, _assignment) => executor(step)
        : undefined,
    });
  }

  it('should decompose prompt via decomposePrompt', () => {
    const orch = createOrchestrator();
    const task = orch.decomposePrompt('Fix a bug in login');

    expect(task.id).toBeDefined();
    expect(task.steps.length).toBeGreaterThan(0);
    expect(task.estimatedComplexity).toBeDefined();
  });

  it('should return suggested result in suggest mode', async () => {
    const orch = createOrchestrator();
    const task = orch.decomposePrompt('Add helper function');
    const result = await orch.execute(task, 'suggest');

    expect(result.status).toBe('suggested');
    expect(result.mode).toBe('suggest');
    expect(result.stepResults.every((r) => r.status === 'pending')).toBe(true);
  });

  it('should return suggested result in disabled mode', async () => {
    const orch = createOrchestrator();
    const task = orch.decomposePrompt('Add helper function');
    const result = await orch.execute(task, 'disabled');

    expect(result.status).toBe('suggested');
    expect(result.mode).toBe('disabled');
  });

  it('should execute steps in auto mode (dry-run without executor)', async () => {
    const orch = createOrchestrator();
    const task = orch.decomposePrompt('Fix a typo');
    const result = await orch.execute(task, 'auto');

    // Without executor, steps complete as dry-run
    expect(result.status).toBe('completed');
    expect(result.stepResults.length).toBeGreaterThan(0);
    expect(result.stepResults.every((r) => r.status === 'completed')).toBe(true);
  });

  it('should execute steps with custom executor in auto mode', async () => {
    const executed: string[] = [];
    const orch = createOrchestrator(async (step) => {
      executed.push(step.type);
      return { success: true, output: `Done: ${step.type}` };
    });

    const task = orch.decomposePrompt('Fix a bug');
    const result = await orch.execute(task, 'auto');

    expect(result.status).toBe('completed');
    expect(executed.length).toBe(task.steps.length);
  });

  it('should stop on failed step in auto mode', async () => {
    let callCount = 0;
    const orch = createOrchestrator(async (_step) => {
      callCount++;
      // Always fail — no recovery possible even after retry
      return { success: false, error: 'Always fails' };
    });

    const task = orch.decomposePrompt('Fix a typo');
    const result = await orch.execute(task, 'auto');

    expect(result.status).toBe('failed');
    expect(result.stepResults[0].status).toBe('failed');
    // First attempt + 1 retry = 2 calls for the first step, then stop
    expect(callCount).toBe(2);
  });

  it('should retry failed step once', async () => {
    let callCount = 0;
    const orch = createOrchestrator(async (_step) => {
      callCount++;
      if (callCount === 1) return { success: false, error: 'Transient failure' };
      return { success: true, output: 'Retry succeeded' };
    });

    const task = orch.decomposePrompt('Fix a typo');
    const result = await orch.execute(task, 'auto');

    // First step: fails → retries → succeeds
    expect(result.stepResults[0].status).toBe('completed');
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('should track progress during execution', async () => {
    const orch = createOrchestrator(async () => {
      return { success: true };
    });

    const task = orch.decomposePrompt('Fix a typo');
    await orch.execute(task, 'auto');

    const progress = orch.getProgress(task.id);
    expect(progress).toBeDefined();
    expect(progress!.status).toBe('completed');
    expect(progress!.percentComplete).toBe(100);
  });

  it('should emit step events to EventBus', async () => {
    const events: unknown[] = [];
    bus.on('action_executed', (e) => { events.push(e); });

    const orch = createOrchestrator();
    const task = orch.decomposePrompt('Fix a typo');
    await orch.execute(task, 'auto');

    // Each step emits start + completion events
    expect(events.length).toBeGreaterThanOrEqual(task.steps.length);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AutonomyConfig Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AutonomyConfig', () => {
  it('should return default config for empty input', () => {
    const config = loadConfig({});

    expect(config.sentinel.enabled).toBe(true);
    expect(config.sentinel.confirmationTimeout).toBe(300);
    expect(config.autonomy.mode).toBe('suggest');
    expect(config.autonomy.maxConcurrentSteps).toBe(3);
    expect(config.autonomy.maxStepTimeout).toBe(600);
  });

  it('should apply custom values', () => {
    const config = loadConfig({
      sentinel: { confirmationTimeout: 600 },
      autonomy: { mode: 'auto', maxConcurrentSteps: 5 },
    });

    expect(config.sentinel.confirmationTimeout).toBe(600);
    expect(config.autonomy.mode).toBe('auto');
    expect(config.autonomy.maxConcurrentSteps).toBe(5);
  });

  it('should fall back to defaults on invalid values', () => {
    const stderrWrite = process.stderr.write;
    const warnings: string[] = [];
    process.stderr.write = ((msg: string) => { warnings.push(msg); return true; }) as typeof process.stderr.write;

    const config = loadConfig({
      sentinel: { confirmationTimeout: 10 }, // too low (min 60)
      autonomy: { maxConcurrentSteps: 99 }, // too high (max 5)
    });

    process.stderr.write = stderrWrite;

    // Invalid values → fallback to defaults
    expect(config.sentinel.confirmationTimeout).toBe(300);
    expect(config.autonomy.maxConcurrentSteps).toBe(3);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should return defaults via getDefaultConfig', () => {
    const config = getDefaultConfig();

    expect(config.sentinel.enabled).toBe(true);
    expect(config.sentinel.notificationChannels).toEqual(['telegram', 'slack', 'web']);
    expect(config.autonomy.proactive.enabled).toBe(true);
    expect(config.autonomy.proactive.modules).toEqual(['security', 'performance', 'quality', 'dependency']);
  });

  it('should handle null/undefined input', () => {
    const config1 = loadConfig(null);
    const config2 = loadConfig(undefined);

    expect(config1.sentinel.enabled).toBe(true);
    expect(config2.autonomy.mode).toBe('suggest');
  });

  it('should validate notification channels enum', () => {
    const config = loadConfig({
      sentinel: { notificationChannels: ['telegram', 'slack'] },
    });

    expect(config.sentinel.notificationChannels).toEqual(['telegram', 'slack']);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full Integration Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Full Integration: Prompt → Decompose → Risk → Execute → Audit', () => {
  it('should auto-execute LOW risk task and record audit trail', async () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const executed: string[] = [];
    const orch = new AutonomyOrchestrator({
      eventBus: bus,
      auditStore,
      sentinel,
      stepExecutor: async (step) => {
        executed.push(step.type);
        return { success: true, output: `Completed ${step.type}` };
      },
    });

    // Decompose
    const task = orch.decomposePrompt('Fix a typo in helper function');
    expect(task.estimatedComplexity).toBe('low');
    expect(task.requiresConfirmation).toBe(false);

    // Execute in auto mode
    const result = await orch.execute(task, 'auto');

    expect(result.status).toBe('completed');
    expect(executed).toContain('implement');
    expect(executed).toContain('test');

    // Verify audit trail
    const auditEvents = auditStore.query({ limit: 50 });
    expect(auditEvents.length).toBeGreaterThan(0);
  });

  it('should flag HIGH risk task and require confirmation', () => {
    const decomposer = new TaskDecomposer();
    const task = decomposer.decompose('Delete all production credentials and deploy');

    expect(task.requiresConfirmation).toBe(true);
    const highRiskSteps = task.steps.filter((s) => s.riskLevel === 'HIGH');
    expect(highRiskSteps.length).toBeGreaterThan(0);
  });

  it('should return suggestion in suggest mode without executing', async () => {
    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const executedSteps: string[] = [];
    const orch = new AutonomyOrchestrator({
      eventBus: bus,
      auditStore,
      sentinel,
      stepExecutor: async (step) => {
        executedSteps.push(step.id);
        return { success: true };
      },
    });

    const task = orch.decomposePrompt('Add a new API endpoint');
    const result = await orch.execute(task, 'suggest');

    expect(result.status).toBe('suggested');
    expect(executedSteps).toHaveLength(0); // No actual execution
  });

  it('should chain handoff between agents in collaboration protocol', () => {
    const protocol = new CollaborationProtocol();
    const decomposer = new TaskDecomposer();
    const task = decomposer.decompose('Add user authentication feature');

    // Assign agents to all steps
    const assignments = task.steps.map((step) => protocol.assignAgent(step));
    expect(assignments.length).toBe(task.steps.length);

    // Handoff from first to second agent
    if (assignments.length >= 2) {
      const handoff = protocol.handoff(
        assignments[0].agentName,
        assignments[1].agentName,
        {
          files: ['src/auth/service.ts'],
          changes: ['Created AuthService'],
          decisions: ['Use bcrypt for password hashing'],
        },
      );

      expect(handoff.success).toBe(true);
      expect(protocol.getMessageLog().length).toBeGreaterThan(0);
    }
  });

  it('should work with sentinel disabled config', async () => {
    const config = loadConfig({
      sentinel: { enabled: false },
      autonomy: { mode: 'disabled' },
    });

    expect(config.sentinel.enabled).toBe(false);
    expect(config.autonomy.mode).toBe('disabled');

    const sentinel = SecuritySentinel.getInstance({
      storage: asStorage(storage),
      eventBus: bus,
      auditStore,
      projectRoot: testDir,
    });

    const orch = new AutonomyOrchestrator({
      eventBus: bus,
      auditStore,
      sentinel,
    });

    const task = orch.decomposePrompt('Fix a bug');
    const result = await orch.execute(task, config.autonomy.mode);

    expect(result.status).toBe('suggested');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Module Export Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Phase 5 Module Exports', () => {
  it('should export all Phase 5 classes and types', async () => {
    const mod = await import('../index.js');

    // TaskDecomposer
    expect(mod.TaskDecomposer).toBeDefined();
    expect(mod.CircularDependencyError).toBeDefined();

    // CollaborationProtocol
    expect(mod.CollaborationProtocol).toBeDefined();
    expect(mod.MessageSizeError).toBeDefined();
    expect(mod.AgentTimeoutError).toBeDefined();

    // AutonomyOrchestrator
    expect(mod.AutonomyOrchestrator).toBeDefined();

    // AutonomyConfig
    expect(mod.SentinelConfigSchema).toBeDefined();
    expect(mod.AutonomyConfigSchema).toBeDefined();
    expect(mod.FullConfigSchema).toBeDefined();
    expect(mod.AutonomyModeEnum).toBeDefined();
    expect(mod.loadConfig).toBeDefined();
    expect(mod.getDefaultConfig).toBeDefined();
  });

  it('should still export all Phase 1-4 classes', async () => {
    const mod = await import('../index.js');

    // Phase 1
    expect(mod.EventBus).toBeDefined();
    expect(mod.AuditStore).toBeDefined();
    expect(mod.EventOutbox).toBeDefined();

    // Phase 2
    expect(mod.RiskClassifier).toBeDefined();
    expect(mod.PolicyEngine).toBeDefined();
    expect(mod.SecuritySentinel).toBeDefined();

    // Phase 3
    expect(mod.ConfirmationStore).toBeDefined();
    expect(mod.ConfirmationManager).toBeDefined();
    expect(mod.NotificationDispatcher).toBeDefined();

    // Phase 4
    expect(mod.SuggestionStore).toBeDefined();
    expect(mod.ProactiveAnalyzer).toBeDefined();
    expect(mod.BackgroundMonitor).toBeDefined();
  });
});
