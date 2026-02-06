/**
 * JobQueue - Priority Queue with Concurrency Control
 * Phase 2: Job/Order System
 *
 * Features:
 * - Priority-based execution (1=highest, 10=lowest)
 * - Concurrency limit (default 3)
 * - Retry with exponential backoff + jitter
 * - Execution timeout per action (10min) and per job (60min)
 */

import { Job, JobQueueConfig, DEFAULT_QUEUE_CONFIG, nowISO } from './types.js';
import { JobManager } from './JobManager.js';
import { JobStore } from './JobStore.js';
import { LogLevel } from '../daemon/types.js';

export class JobQueue {
  private readonly config: JobQueueConfig;
  private store: JobStore;
  private manager: JobManager;
  private running: Set<string> = new Set();
  private processing = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    store: JobStore,
    manager: JobManager,
    config?: Partial<JobQueueConfig>,
    logger?: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.store = store;
    this.manager = manager;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.logger = logger || (() => {});
  }

  /** Start the queue processor */
  start(): void {
    // Poll for pending jobs every 2 seconds
    this.pollTimer = setInterval(() => {
      this.processQueue();
    }, 2000);

    // Cleanup old jobs every 24 hours
    this.cleanupTimer = setInterval(() => {
      this.manager.cleanup(30);
    }, 24 * 60 * 60 * 1000);

    this.logger('info', 'Job queue started', { maxConcurrency: this.config.maxConcurrency });
  }

  /** Stop the queue processor */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.logger('info', 'Job queue stopped');
  }

  /** Get number of currently running jobs */
  getRunningCount(): number {
    return this.running.size;
  }

  /** Check if a job is currently running */
  isRunning(jobId: string): boolean {
    return this.running.has(jobId);
  }

  /** Manually trigger queue processing */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Get available slots
      const availableSlots = this.config.maxConcurrency - this.running.size;
      if (availableSlots <= 0) return;

      // Get pending jobs
      const pendingJobs = this.store.getPendingJobs(availableSlots);

      for (const job of pendingJobs) {
        if (this.running.size >= this.config.maxConcurrency) break;
        this.executeJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  // ========================================================================
  // Private
  // ========================================================================

  private async executeJob(job: Job): Promise<void> {
    this.running.add(job.id);

    try {
      // Process job through pipeline (parse → plan → evaluate)
      await this.manager.processJob(job.id);

      // Check if job was approved
      const updatedJob = this.manager.getJob(job.id);
      if (!updatedJob) {
        this.running.delete(job.id);
        return;
      }

      if (updatedJob.status === 'approved') {
        // Execute the job
        this.manager.transitionJob(job.id, 'executing', 'Starting execution');

        // Job execution timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Job execution timeout')), this.config.jobTimeoutMs);
        });

        try {
          // Placeholder: actual execution will be done by ClaudeCodeBridge (Phase 4)
          await Promise.race([
            this.simulateExecution(updatedJob),
            timeoutPromise,
          ]);

          this.manager.completeJob(job.id, 'Execution completed successfully');
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          this.handleJobFailure(job.id, error);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger('error', `Job ${job.id} execution error: ${error}`);
      this.handleJobFailure(job.id, error);
    } finally {
      this.running.delete(job.id);
    }
  }

  private async simulateExecution(job: Job): Promise<void> {
    // Placeholder for actual Claude Code execution
    this.logger('debug', `Simulating execution for job ${job.id}`);
    // In production, this will use ClaudeCodeBridge
  }

  private handleJobFailure(jobId: string, error: string): void {
    const job = this.manager.getJob(jobId);
    if (!job) return;

    this.manager.failJob(jobId, error);

    // Check if retry is possible
    if (job.retryCount < this.config.maxRetries) {
      const backoffMs = this.calculateBackoff(job.retryCount);
      this.logger('info', `Job ${jobId} will retry in ${backoffMs}ms (attempt ${job.retryCount + 1})`);
      this.manager.retryJob(jobId);
    } else {
      this.logger('warn', `Job ${jobId} exceeded max retries`);
    }
  }

  /** Calculate backoff with jitter */
  private calculateBackoff(retryCount: number): number {
    const base = this.config.retryBaseDelayMs * Math.pow(2, retryCount);
    const jitter = base * (this.config.retryJitterPercent / 100);
    const randomJitter = (Math.random() * 2 - 1) * jitter;
    return Math.round(base + randomJitter);
  }
}
