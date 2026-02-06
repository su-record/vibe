/**
 * JobManager - Job Lifecycle Management
 * Phase 2: Job/Order System
 *
 * State machine: pending → parsing → planning → evaluating → approved/rejected → executing → completed/failed
 */

import {
  Job,
  JobCreateInput,
  JobStatus,
  ActionPlan,
  ParsedIntent,
  isValidTransition,
  nowISO,
} from './types.js';
import { JobStore } from './JobStore.js';
import { IntentParser } from './IntentParser.js';
import { ActionPlanGenerator } from './ActionPlanGenerator.js';
import { LogLevel } from '../daemon/types.js';

export type JobEventType = 'created' | 'status_changed' | 'completed' | 'failed';

export interface JobEvent {
  type: JobEventType;
  job: Job;
  previousStatus?: JobStatus;
}

export type JobEventListener = (event: JobEvent) => void;

export class JobManager {
  private store: JobStore;
  private intentParser: IntentParser;
  private planGenerator: ActionPlanGenerator;
  private listeners: JobEventListener[] = [];
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    store: JobStore,
    logger: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.store = store;
    this.intentParser = new IntentParser();
    this.planGenerator = new ActionPlanGenerator();
    this.logger = logger;
  }

  // ========================================================================
  // Job Lifecycle
  // ========================================================================

  /** Create a new job from external request */
  createJob(input: JobCreateInput): Job {
    const job = this.store.createJob(input);
    this.logger('info', `Job created: ${job.id}`, { intent: input.intent });
    this.emit({ type: 'created', job });
    return job;
  }

  /** Transition job to next status */
  transitionJob(jobId: string, newStatus: JobStatus, message?: string): boolean {
    const job = this.store.getJob(jobId);
    if (!job) {
      this.logger('warn', `Job not found: ${jobId}`);
      return false;
    }

    if (!isValidTransition(job.status, newStatus)) {
      this.logger('warn', `Invalid transition: ${job.status} → ${newStatus}`, { jobId });
      return false;
    }

    const previousStatus = job.status;
    this.store.updateJobStatus(jobId, newStatus, message);
    this.logger('info', `Job ${jobId}: ${previousStatus} → ${newStatus}`);

    const updatedJob = this.store.getJob(jobId)!;
    this.emit({ type: 'status_changed', job: updatedJob, previousStatus });

    return true;
  }

  /** Process a job through the pipeline: parse → plan → evaluate */
  async processJob(jobId: string): Promise<void> {
    const job = this.store.getJob(jobId);
    if (!job || job.status !== 'pending') {
      this.logger('warn', `Cannot process job ${jobId}: not in pending state`);
      return;
    }

    // Step 1: Parse intent
    this.transitionJob(jobId, 'parsing', 'Starting intent parsing');
    let parsedIntent: ParsedIntent;
    try {
      parsedIntent = this.intentParser.parse(job.intent, job.projectPath);
    } catch (err) {
      this.store.updateJobError(jobId, `Intent parsing failed: ${err}`);
      this.transitionJob(jobId, 'planning'); // skip to planning with default
      parsedIntent = {
        type: 'general',
        rawText: job.intent,
        summary: job.intent,
        projectPath: job.projectPath,
        targets: [],
        confidence: 0.5,
      };
    }

    // Step 2: Generate ActionPlan
    this.transitionJob(jobId, 'planning', 'Generating action plan');
    let plan: ActionPlan;
    try {
      plan = this.planGenerator.generate(jobId, parsedIntent);
      this.store.saveActionPlan(plan);
    } catch (err) {
      this.store.updateJobError(jobId, `Plan generation failed: ${err}`);
      // Create minimal plan
      plan = this.planGenerator.generateMinimal(jobId, parsedIntent);
      this.store.saveActionPlan(plan);
    }

    // Step 3: Evaluate (Policy check - delegated to Phase 3)
    this.transitionJob(jobId, 'evaluating', 'Evaluating against policies');

    // Default: auto-approve low risk, require approval for high/critical
    if (plan.riskLevel === 'high' || plan.riskLevel === 'critical') {
      this.transitionJob(jobId, 'awaiting_approval', `Risk level: ${plan.riskLevel}`);
    } else {
      this.transitionJob(jobId, 'approved', 'Auto-approved (low risk)');
    }
  }

  /** Approve a job that's awaiting approval */
  approveJob(jobId: string): boolean {
    return this.transitionJob(jobId, 'approved', 'Approved by user');
  }

  /** Reject a job */
  rejectJob(jobId: string, reason?: string): boolean {
    return this.transitionJob(jobId, 'rejected', reason || 'Rejected by user');
  }

  /** Cancel a job */
  cancelJob(jobId: string): boolean {
    const job = this.store.getJob(jobId);
    if (!job) return false;

    if (job.status === 'executing') {
      return this.transitionJob(jobId, 'cancelled', 'Cancelled by user');
    }
    // For non-executing jobs, delete them
    return this.store.deleteJob(jobId);
  }

  /** Mark job as completed */
  completeJob(jobId: string, result: string): boolean {
    this.store.updateJobResult(jobId, result);
    const success = this.transitionJob(jobId, 'completed', 'Execution completed');
    if (success) {
      const job = this.store.getJob(jobId)!;
      this.emit({ type: 'completed', job });
    }
    return success;
  }

  /** Mark job as failed */
  failJob(jobId: string, error: string): boolean {
    this.store.updateJobError(jobId, error);
    const success = this.transitionJob(jobId, 'failed', error);
    if (success) {
      const job = this.store.getJob(jobId)!;
      this.emit({ type: 'failed', job });
    }
    return success;
  }

  /** Retry a failed job */
  retryJob(jobId: string): boolean {
    const job = this.store.getJob(jobId);
    if (!job || job.status !== 'failed') return false;
    if (job.retryCount >= job.maxRetries) {
      this.logger('warn', `Job ${jobId} exceeded max retries (${job.maxRetries})`);
      return false;
    }

    this.store.incrementRetry(jobId);
    this.logger('info', `Job ${jobId} queued for retry (attempt ${job.retryCount + 1})`);
    return true;
  }

  // ========================================================================
  // Query
  // ========================================================================

  getJob(id: string): Job | null {
    return this.store.getJob(id);
  }

  listJobs(options?: Parameters<JobStore['listJobs']>[0]): Job[] {
    return this.store.listJobs(options);
  }

  getActionPlan(planId: string): ActionPlan | null {
    return this.store.getActionPlan(planId);
  }

  getJobLogs(jobId: string): ReturnType<JobStore['getLogs']> {
    return this.store.getLogs(jobId);
  }

  // ========================================================================
  // Crash Recovery
  // ========================================================================

  /** Recover jobs after daemon restart */
  recoverJobs(): void {
    // executing → failed (with retry if applicable)
    const executing = this.store.listJobs({ status: 'executing' });
    for (const job of executing) {
      this.logger('info', `Recovering executing job ${job.id}`);
      if (job.retryCount < job.maxRetries) {
        this.store.incrementRetry(job.id);
      } else {
        this.store.updateJobStatus(job.id, 'failed', 'Daemon restart recovery');
      }
    }

    // parsing/planning/evaluating → pending (re-process)
    for (const status of ['parsing', 'planning', 'evaluating'] as JobStatus[]) {
      const jobs = this.store.listJobs({ status });
      for (const job of jobs) {
        this.logger('info', `Recovering ${status} job ${job.id} → pending`);
        this.store.updateJobStatus(job.id, 'pending', 'Daemon restart recovery');
      }
    }

    // awaiting_approval → keep as-is
  }

  // ========================================================================
  // Events
  // ========================================================================

  on(listener: JobEventListener): void {
    this.listeners.push(listener);
  }

  off(listener: JobEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private emit(event: JobEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        this.logger('error', 'Job event listener error', err);
      }
    }
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  cleanup(maxAgeDays: number = 30): number {
    return this.store.cleanupOldJobs(maxAgeDays);
  }

  close(): void {
    this.store.close();
  }
}
