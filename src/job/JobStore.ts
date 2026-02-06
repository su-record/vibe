/**
 * JobStore - SQLite Storage for Jobs
 * Phase 2: Job/Order System
 *
 * Tables: jobs, action_plans, job_logs
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import {
  Job,
  JobCreateInput,
  JobStatus,
  JobLog,
  ActionPlan,
  generateJobId,
  nowISO,
} from './types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const DEFAULT_DB_PATH = path.join(VIBE_DIR, 'jobs.db');

export class JobStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || DEFAULT_DB_PATH;
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.initTables();
  }

  // ========================================================================
  // Job CRUD
  // ========================================================================

  createJob(input: JobCreateInput): Job {
    const job: Job = {
      id: generateJobId(),
      status: 'pending',
      intent: input.intent,
      projectPath: input.projectPath,
      priority: input.priority ?? 5,
      retryCount: 0,
      maxRetries: 3,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      source: input.source,
      metadata: input.metadata,
    };

    this.db.prepare(`
      INSERT INTO jobs (id, status, intent, project_path, priority, retry_count, max_retries, created_at, updated_at, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.status, job.intent, job.projectPath,
      job.priority, job.retryCount, job.maxRetries,
      job.createdAt, job.updatedAt,
      job.source || null,
      job.metadata ? JSON.stringify(job.metadata) : null,
    );

    return job;
  }

  getJob(id: string): Job | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToJob(row) : null;
  }

  listJobs(options?: {
    status?: JobStatus;
    projectPath?: string;
    limit?: number;
    offset?: number;
    includeAll?: boolean;
  }): Job[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options?.projectPath) {
      conditions.push('project_path = ?');
      params.push(options.projectPath);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = this.db.prepare(
      `SELECT * FROM jobs ${where} ORDER BY priority ASC, created_at ASC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Record<string, unknown>[];

    return rows.map((r) => this.rowToJob(r));
  }

  updateJobStatus(id: string, newStatus: JobStatus, message?: string): boolean {
    const job = this.getJob(id);
    if (!job) return false;

    const now = nowISO();
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: unknown[] = [newStatus, now];

    if (newStatus === 'executing' && !job.startedAt) {
      updates.push('started_at = ?');
      params.push(now);
    }
    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
      updates.push('completed_at = ?');
      params.push(now);
    }

    params.push(id);

    const tx = this.db.transaction(() => {
      this.db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      this.addLog(id, job.status, newStatus, message);
    });

    tx();
    return true;
  }

  updateJobResult(id: string, result: string): void {
    this.db.prepare('UPDATE jobs SET result = ?, updated_at = ? WHERE id = ?')
      .run(result, nowISO(), id);
  }

  updateJobError(id: string, error: string): void {
    this.db.prepare('UPDATE jobs SET error = ?, updated_at = ? WHERE id = ?')
      .run(error, nowISO(), id);
  }

  incrementRetry(id: string): void {
    const now = nowISO();
    this.db.prepare(
      'UPDATE jobs SET retry_count = retry_count + 1, status = ?, updated_at = ? WHERE id = ?'
    ).run('pending', now, id);
  }

  deleteJob(id: string): boolean {
    const result = this.db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ========================================================================
  // ActionPlan
  // ========================================================================

  saveActionPlan(plan: ActionPlan): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO action_plans (id, job_id, intent_json, actions_json, risk_level, confidence, estimated_files, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      plan.id, plan.jobId,
      JSON.stringify(plan.intent),
      JSON.stringify(plan.actions),
      plan.riskLevel, plan.confidence, plan.estimatedFiles,
      plan.createdAt,
    );

    this.db.prepare('UPDATE jobs SET action_plan_id = ?, updated_at = ? WHERE id = ?')
      .run(plan.id, nowISO(), plan.jobId);
  }

  getActionPlan(planId: string): ActionPlan | null {
    const row = this.db.prepare('SELECT * FROM action_plans WHERE id = ?').get(planId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      jobId: row.job_id as string,
      intent: JSON.parse(row.intent_json as string),
      actions: JSON.parse(row.actions_json as string),
      riskLevel: row.risk_level as ActionPlan['riskLevel'],
      confidence: row.confidence as number,
      estimatedFiles: row.estimated_files as number,
      createdAt: row.created_at as string,
    };
  }

  // ========================================================================
  // Job Logs
  // ========================================================================

  addLog(jobId: string, fromStatus: JobStatus, toStatus: JobStatus, message?: string): void {
    this.db.prepare(`
      INSERT INTO job_logs (job_id, from_status, to_status, message, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, fromStatus, toStatus, message || null, nowISO());
  }

  getLogs(jobId: string): JobLog[] {
    return this.db.prepare(
      'SELECT * FROM job_logs WHERE job_id = ? ORDER BY timestamp ASC'
    ).all(jobId) as JobLog[];
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  cleanupOldJobs(maxAgeDays: number = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    const cutoffISO = cutoff.toISOString();

    const result = this.db.prepare(
      "DELETE FROM jobs WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled', 'rejected')"
    ).run(cutoffISO);

    // WAL checkpoint
    this.db.pragma('wal_checkpoint(TRUNCATE)');

    return result.changes;
  }

  // ========================================================================
  // Pending Jobs for Queue
  // ========================================================================

  getPendingJobs(limit: number = 10): Job[] {
    const rows = this.db.prepare(
      `SELECT * FROM jobs WHERE status = 'pending' AND (next_run_at IS NULL OR next_run_at <= ?)
       ORDER BY priority ASC, created_at ASC LIMIT ?`
    ).all(nowISO(), limit) as Record<string, unknown>[];

    return rows.map((r) => this.rowToJob(r));
  }

  getJobCount(status?: JobStatus): number {
    if (status) {
      const row = this.db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = ?').get(status) as Record<string, unknown>;
      return row.count as number;
    }
    const row = this.db.prepare('SELECT COUNT(*) as count FROM jobs').get() as Record<string, unknown>;
    return row.count as number;
  }

  close(): void {
    this.db.close();
  }

  // ========================================================================
  // Private
  // ========================================================================

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        intent TEXT NOT NULL,
        project_path TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        next_run_at TEXT,
        action_plan_id TEXT,
        result TEXT,
        error TEXT,
        source TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_project_path ON jobs(project_path);
      CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);

      CREATE TABLE IF NOT EXISTS action_plans (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        intent_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        risk_level TEXT NOT NULL DEFAULT 'none',
        confidence REAL NOT NULL DEFAULT 0,
        estimated_files INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_action_plans_job ON action_plans(job_id);

      CREATE TABLE IF NOT EXISTS job_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        message TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_job_logs_job ON job_logs(job_id);
      CREATE INDEX IF NOT EXISTS idx_job_logs_timestamp ON job_logs(timestamp);
    `);
  }

  private rowToJob(row: Record<string, unknown>): Job {
    return {
      id: row.id as string,
      status: row.status as JobStatus,
      intent: row.intent as string,
      projectPath: row.project_path as string,
      priority: row.priority as number,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      startedAt: row.started_at as string | undefined,
      completedAt: row.completed_at as string | undefined,
      nextRunAt: row.next_run_at as string | undefined,
      actionPlanId: row.action_plan_id as string | undefined,
      result: row.result as string | undefined,
      error: row.error as string | undefined,
      source: row.source as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }
}
