/**
 * JobManager & ProgressReporter 테스트
 * Phase 4: Scenarios 1, 2, 4, 5, 6, 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { JobManager } from './AgentJobManager.js';
import { ProgressReporter } from './ProgressReporter.js';
import type { JobProgress } from './agent-job-types.js';

function createTempDbPath(): string {
  const dir = path.join(os.tmpdir(), `vibe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'test-jobs.db');
}

describe('JobManager', () => {
  let manager: JobManager;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    manager = new JobManager(vi.fn(), dbPath);
  });

  afterEach(() => {
    manager.close();
    try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
  });

  // Scenario 1: Job 생성 및 즉시 응답
  describe('Scenario 1: Job creation', () => {
    it('should create a job and return immediately', () => {
      const job = manager.create('chat-1', 'Build login feature');

      expect(job.id).toBeTruthy();
      expect(job.chatId).toBe('chat-1');
      expect(job.task).toBe('Build login feature');
      expect(job.status).toBe('queued');
    });

    it('should persist job to SQLite', () => {
      const job = manager.create('chat-1', 'Test task');
      const retrieved = manager.getStatus(job.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(job.id);
      expect(retrieved!.status).toBe('queued');
    });
  });

  // Scenario 2: SQLite 영속화
  describe('Scenario 2: SQLite persistence', () => {
    it('should survive manager recreation', () => {
      const job = manager.create('chat-1', 'Persistent task');
      const jobId = job.id;
      manager.close();

      // Recreate manager with same DB
      const manager2 = new JobManager(vi.fn(), dbPath);
      const retrieved = manager2.getStatus(jobId);

      expect(retrieved).toBeDefined();
      expect(retrieved!.task).toBe('Persistent task');
      manager2.close();
    });
  });

  // Scenario 5: Job 완료
  describe('Scenario 5: Job completion', () => {
    it('should complete job with result', async () => {
      const onComplete = vi.fn();
      manager.setCallbacks({ onComplete });

      const job = manager.create('chat-1', 'Quick task');
      await manager.start(job.id, async () => 'Task completed successfully');

      const completed = manager.getStatus(job.id);
      expect(completed!.status).toBe('completed');
      expect(completed!.result).toBe('Task completed successfully');
      expect(onComplete).toHaveBeenCalledWith('chat-1', job.id, 'Task completed successfully');
    });
  });

  // Scenario 6: Job 취소
  describe('Scenario 6: Job cancellation', () => {
    it('should cancel a running job', async () => {
      const job = manager.create('chat-1', 'Long task');

      // Start a long-running job
      const startPromise = manager.start(job.id, async (_task, signal) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 60_000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        });
        return 'done';
      });

      // Wait a bit then cancel
      await new Promise((r) => setTimeout(r, 100));
      const cancelled = manager.cancel(job.id);
      expect(cancelled).toBe(true);

      await startPromise;

      const status = manager.getStatus(job.id);
      expect(status!.status).toBe('cancelled');
    });
  });

  // Scenario 7: 동시 실행 제한
  describe('Scenario 7: Concurrent job limit', () => {
    it('should track running count', async () => {
      expect(manager.getRunningCount()).toBe(0);

      const job1 = manager.create('chat-1', 'Task 1');
      const job2 = manager.create('chat-1', 'Task 2');

      // Start first job (non-blocking)
      const p1 = manager.start(job1.id, async () => {
        await new Promise((r) => setTimeout(r, 200));
        return 'done1';
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(manager.getRunningCount()).toBe(1);

      await p1;
      expect(manager.getRunningCount()).toBe(0);
    });
  });

  describe('listActive', () => {
    it('should list active jobs for chatId', () => {
      manager.create('chat-1', 'Task A');
      manager.create('chat-1', 'Task B');
      manager.create('chat-2', 'Task C');

      const chat1Jobs = manager.listActive('chat-1');
      expect(chat1Jobs).toHaveLength(2);

      const chat2Jobs = manager.listActive('chat-2');
      expect(chat2Jobs).toHaveLength(1);
    });
  });

  describe('Startup recovery', () => {
    it('should mark running jobs as failed on restart', () => {
      const job = manager.create('chat-1', 'Interrupted task');

      // Manually set to running (simulating crash)
      const db = (manager as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE agent_jobs SET status = ? WHERE id = ?').run('running', job.id);
      manager.close();

      // New manager should recover
      const manager2 = new JobManager(vi.fn(), dbPath);
      const recovered = manager2.getStatus(job.id);

      expect(recovered!.status).toBe('failed');
      expect(recovered!.result).toBe('system_restart');
      manager2.close();
    });
  });
});

describe('ProgressReporter', () => {
  // Scenario 4: Rate limiting
  describe('Scenario 4: Rate limiting', () => {
    it('should rate-limit progress updates to 3 seconds', async () => {
      vi.useFakeTimers();
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const reporter = new ProgressReporter(sendFn);

      const progress: JobProgress = { phase: 1, totalPhases: 3, message: 'Working...', percent: 30 };

      // Send 5 updates in rapid succession
      await reporter.reportProgress('chat-1', 'job-1', { ...progress, percent: 10 });
      await reporter.reportProgress('chat-1', 'job-1', { ...progress, percent: 20 });
      await reporter.reportProgress('chat-1', 'job-1', { ...progress, percent: 30 });
      await reporter.reportProgress('chat-1', 'job-1', { ...progress, percent: 40 });
      await reporter.reportProgress('chat-1', 'job-1', { ...progress, percent: 50 });

      // Only first should have sent immediately
      expect(sendFn).toHaveBeenCalledTimes(1);

      // After 3 seconds, flush pending
      vi.advanceTimersByTime(3000);
      await reporter.reportProgress('chat-1', 'job-1', { ...progress, percent: 60 });
      expect(sendFn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('Report lifecycle', () => {
    it('should report start, complete', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const reporter = new ProgressReporter(sendFn);

      await reporter.reportStart('chat-1', 'job-1', 'Build login');
      expect(sendFn).toHaveBeenCalledWith('chat-1', expect.stringContaining('작업을 시작합니다'));

      await reporter.reportComplete('chat-1', 'job-1', 'Login feature built');
      expect(sendFn).toHaveBeenCalledWith('chat-1', expect.stringContaining('작업 완료'));
    });

    it('should report error', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const reporter = new ProgressReporter(sendFn);

      await reporter.reportError('chat-1', 'job-1', 'Something broke');
      expect(sendFn).toHaveBeenCalledWith('chat-1', expect.stringContaining('작업 실패'));
    });
  });

  // Scenario 11: editMessageText fallback
  describe('Scenario 11: editMessageText fallback', () => {
    it('should fallback to new message when edit fails', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const editFn = vi.fn().mockResolvedValue(false); // edit fails
      const reporter = new ProgressReporter(sendFn, editFn);

      reporter.setMessageId('job-1', 123);

      const progress: JobProgress = { phase: 1, totalPhases: 3, message: 'Working', percent: 33 };
      await reporter.reportProgress('chat-1', 'job-1', progress);

      // editFn was tried
      expect(editFn).toHaveBeenCalledWith('chat-1', 123, expect.any(String));
      // Fallback to sendFn
      expect(sendFn).toHaveBeenCalled();
    });
  });
});
