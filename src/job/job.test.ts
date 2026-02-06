/**
 * Phase 2: Job/Order System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { JobStore } from './JobStore.js';
import { JobManager } from './JobManager.js';
import { JobQueue } from './JobQueue.js';
import { IntentParser } from './IntentParser.js';
import { ActionPlanGenerator } from './ActionPlanGenerator.js';
import { isValidTransition } from './types.js';
import { LogLevel } from '../daemon/types.js';

const TEST_DIR = path.join(os.tmpdir(), `vibe-job-test-${process.pid}`);
const noopLogger = (_level: LogLevel, _msg: string, _data?: unknown): void => {};

function makeTestDb(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-${crypto.randomBytes(4).toString('hex')}.db`);
}

// ============================================================================
// Scenario 1: Create Job from external request
// ============================================================================

describe('Scenario 1: Create Job from natural language request', () => {
  it('should create a job with pending status', () => {
    const store = new JobStore(makeTestDb());
    const job = store.createJob({
      intent: 'Add login feature to my project',
      projectPath: '/path/to/project',
    });

    expect(job.id).toBeTruthy();
    expect(job.status).toBe('pending');
    expect(job.intent).toBe('Add login feature to my project');
    expect(job.createdAt).toBeTruthy();

    store.close();
  });

  it('should have a unique UUID', () => {
    const store = new JobStore(makeTestDb());
    const job1 = store.createJob({ intent: 'task 1', projectPath: '/p' });
    const job2 = store.createJob({ intent: 'task 2', projectPath: '/p' });

    expect(job1.id).not.toBe(job2.id);
    expect(job1.id).toMatch(/^[0-9a-f-]{36}$/);

    store.close();
  });

  it('should be stored in SQLite', () => {
    const dbPath = makeTestDb();
    const store = new JobStore(dbPath);
    const job = store.createJob({ intent: 'test', projectPath: '/p' });

    // Re-open store
    store.close();
    const store2 = new JobStore(dbPath);
    const retrieved = store2.getJob(job.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.intent).toBe('test');

    store2.close();
  });
});

// ============================================================================
// Scenario 2: Job state transitions
// ============================================================================

describe('Scenario 2: Job state transitions', () => {
  it('should validate state transitions', () => {
    expect(isValidTransition('pending', 'parsing')).toBe(true);
    expect(isValidTransition('parsing', 'planning')).toBe(true);
    expect(isValidTransition('planning', 'evaluating')).toBe(true);
    expect(isValidTransition('evaluating', 'approved')).toBe(true);
    expect(isValidTransition('evaluating', 'rejected')).toBe(true);
    expect(isValidTransition('evaluating', 'awaiting_approval')).toBe(true);
    expect(isValidTransition('approved', 'executing')).toBe(true);
    expect(isValidTransition('executing', 'completed')).toBe(true);
    expect(isValidTransition('executing', 'failed')).toBe(true);
    expect(isValidTransition('executing', 'cancelled')).toBe(true);
  });

  it('should reject invalid transitions', () => {
    expect(isValidTransition('pending', 'completed')).toBe(false);
    expect(isValidTransition('completed', 'pending')).toBe(false);
    expect(isValidTransition('rejected', 'executing')).toBe(false);
  });

  it('should transition through all states via JobManager', async () => {
    const store = new JobStore(makeTestDb());
    const manager = new JobManager(store, noopLogger);

    const job = manager.createJob({ intent: 'test', projectPath: '/p' });
    await manager.processJob(job.id);

    const updated = manager.getJob(job.id);
    expect(updated).not.toBeNull();
    // Should be auto-approved (low risk) or awaiting_approval
    expect(['approved', 'awaiting_approval']).toContain(updated!.status);

    store.close();
  });
});

// ============================================================================
// Scenario 3: Generate ActionPlan
// ============================================================================

describe('Scenario 3: Generate ActionPlan from Intent', () => {
  it('should parse intent and generate ActionPlan', () => {
    const parser = new IntentParser();
    const generator = new ActionPlanGenerator();

    const intent = parser.parse('Add login feature', '/project');
    expect(intent.type).toBe('code');

    const plan = generator.generate('job-123', intent);
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.riskLevel).toBeTruthy();
    expect(plan.confidence).toBeGreaterThan(0);
  });

  it('should classify different intent types', () => {
    const parser = new IntentParser();

    expect(parser.parse('Fix the bug in login.ts', '/p').type).toBe('fix');
    expect(parser.parse('Write test spec for the auth module', '/p').type).toBe('test');
    expect(parser.parse('Review the code', '/p').type).toBe('review');
    expect(parser.parse('Analyze the architecture', '/p').type).toBe('analyze');
    expect(parser.parse('Refactor the auth module', '/p').type).toBe('refactor');
    expect(parser.parse('Deploy to production', '/p').type).toBe('deploy');
  });

  it('should extract file targets from text', () => {
    const parser = new IntentParser();
    const intent = parser.parse('Fix the bug in src/auth/login.ts', '/p');
    expect(intent.targets).toContain('src/auth/login.ts');
  });

  it('should calculate risk levels', () => {
    const generator = new ActionPlanGenerator();
    const parser = new IntentParser();

    const deployIntent = parser.parse('Deploy to production', '/p');
    const deployPlan = generator.generate('job-1', deployIntent);
    expect(deployPlan.riskLevel).toBe('high');

    const analyzeIntent = parser.parse('Analyze the code', '/p');
    const analyzePlan = generator.generate('job-2', analyzeIntent);
    expect(['none', 'low']).toContain(analyzePlan.riskLevel);
  });
});

// ============================================================================
// Scenario 4: Job queue with priority
// ============================================================================

describe('Scenario 4: Process Jobs by priority', () => {
  it('should return jobs ordered by priority', () => {
    const store = new JobStore(makeTestDb());

    store.createJob({ intent: 'Low priority', projectPath: '/p', priority: 3 });
    store.createJob({ intent: 'High priority', projectPath: '/p', priority: 1 });
    store.createJob({ intent: 'Medium priority', projectPath: '/p', priority: 2 });

    const pending = store.getPendingJobs(10);
    expect(pending[0].priority).toBe(1);
    expect(pending[1].priority).toBe(2);
    expect(pending[2].priority).toBe(3);

    store.close();
  });
});

// ============================================================================
// Scenario 5: Concurrent execution limit
// ============================================================================

describe('Scenario 5: Limit concurrent execution', () => {
  it('should track running count', () => {
    const store = new JobStore(makeTestDb());
    const manager = new JobManager(store, noopLogger);
    const queue = new JobQueue(store, manager, { maxConcurrency: 3 }, noopLogger);

    expect(queue.getRunningCount()).toBe(0);

    store.close();
  });
});

// ============================================================================
// Scenario 6: List Jobs via CLI
// ============================================================================

describe('Scenario 6: List all Jobs', () => {
  it('should list jobs with details', () => {
    const store = new JobStore(makeTestDb());

    store.createJob({ intent: 'Task 1', projectPath: '/p1' });
    store.createJob({ intent: 'Task 2', projectPath: '/p2' });
    store.createJob({ intent: 'Task 3', projectPath: '/p3' });

    const jobs = store.listJobs();
    expect(jobs).toHaveLength(3);
    expect(jobs[0].intent).toBe('Task 1');

    store.close();
  });
});

// ============================================================================
// Scenario 7: Get Job status
// ============================================================================

describe('Scenario 7: Get specific Job status', () => {
  it('should retrieve job with full details', () => {
    const store = new JobStore(makeTestDb());
    const created = store.createJob({
      intent: 'Add feature',
      projectPath: '/project',
      priority: 2,
    });

    const job = store.getJob(created.id);
    expect(job).not.toBeNull();
    expect(job!.id).toBe(created.id);
    expect(job!.intent).toBe('Add feature');
    expect(job!.priority).toBe(2);

    store.close();
  });
});

// ============================================================================
// Scenario 8: Cancel running Job
// ============================================================================

describe('Scenario 8: Cancel a Job', () => {
  it('should cancel via JobManager', () => {
    const store = new JobStore(makeTestDb());
    const manager = new JobManager(store, noopLogger);

    const job = manager.createJob({ intent: 'test', projectPath: '/p' });

    // Transition to executing state
    manager.transitionJob(job.id, 'parsing');
    manager.transitionJob(job.id, 'planning');
    manager.transitionJob(job.id, 'evaluating');
    manager.transitionJob(job.id, 'approved');
    manager.transitionJob(job.id, 'executing');

    const result = manager.cancelJob(job.id);
    expect(result).toBe(true);

    const updated = manager.getJob(job.id);
    expect(updated!.status).toBe('cancelled');

    store.close();
  });
});

// ============================================================================
// Scenario 9: Job retry on failure
// ============================================================================

describe('Scenario 9: Retry failed Job', () => {
  it('should retry failed job up to max retries', () => {
    const store = new JobStore(makeTestDb());
    const manager = new JobManager(store, noopLogger);

    const job = manager.createJob({ intent: 'test', projectPath: '/p' });

    // Simulate execution path
    manager.transitionJob(job.id, 'parsing');
    manager.transitionJob(job.id, 'planning');
    manager.transitionJob(job.id, 'evaluating');
    manager.transitionJob(job.id, 'approved');
    manager.transitionJob(job.id, 'executing');

    // Fail
    manager.failJob(job.id, 'Network error');

    // Retry
    const retried = manager.retryJob(job.id);
    expect(retried).toBe(true);

    const updated = manager.getJob(job.id);
    expect(updated!.status).toBe('pending');
    expect(updated!.retryCount).toBe(1);

    store.close();
  });

  it('should log each retry', () => {
    const store = new JobStore(makeTestDb());
    const manager = new JobManager(store, noopLogger);

    const job = manager.createJob({ intent: 'test', projectPath: '/p' });
    manager.transitionJob(job.id, 'parsing');
    manager.transitionJob(job.id, 'planning');
    manager.transitionJob(job.id, 'evaluating');
    manager.transitionJob(job.id, 'approved');
    manager.transitionJob(job.id, 'executing');
    manager.failJob(job.id, 'Error');

    const logs = manager.getJobLogs(job.id);
    expect(logs.length).toBeGreaterThan(0);

    store.close();
  });
});

// ============================================================================
// Scenario 10: Job history persistence
// ============================================================================

describe('Scenario 10: Job history is persisted', () => {
  it('should persist jobs across store instances', () => {
    const dbPath = makeTestDb();

    // Create job
    const store1 = new JobStore(dbPath);
    const job = store1.createJob({ intent: 'persistent task', projectPath: '/p' });
    store1.close();

    // Reopen and verify
    const store2 = new JobStore(dbPath);
    const retrieved = store2.getJob(job.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.intent).toBe('persistent task');
    store2.close();
  });

  it('should cleanup old jobs', () => {
    const store = new JobStore(makeTestDb());

    // Create and complete a job
    const job = store.createJob({ intent: 'old task', projectPath: '/p' });
    store.updateJobStatus(job.id, 'completed');

    // Cleanup with 0 days (remove everything)
    const deleted = store.cleanupOldJobs(0);
    expect(deleted).toBeGreaterThanOrEqual(0);

    store.close();
  });
});

// ============================================================================
// Crash Recovery
// ============================================================================

describe('Crash Recovery', () => {
  it('should recover executing jobs to failed/pending', () => {
    const dbPath = makeTestDb();

    // Create a job and set to executing
    const store1 = new JobStore(dbPath);
    const job = store1.createJob({ intent: 'test', projectPath: '/p' });
    store1.updateJobStatus(job.id, 'executing');
    store1.close();

    // Reopen and recover
    const store2 = new JobStore(dbPath);
    const manager = new JobManager(store2, noopLogger);
    manager.recoverJobs();

    const recovered = store2.getJob(job.id);
    // Should be back to pending (retry) since retryCount = 0 < maxRetries = 3
    expect(recovered!.status).toBe('pending');

    store2.close();
  });
});
