/**
 * JobManager - 비동기 Job 관리
 * Phase 4: Async Job System
 *
 * 기능:
 * - SQLite 영속화 (WAL mode)
 * - 동시 실행: 최대 3개
 * - Job timeout: 10분
 * - AbortController 기반 취소
 * - 7일 retention, startup recovery
 */

import Database from 'better-sqlite3';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import type { AgentJob, JobProgress, JobRow, JobStatus } from './agent-job-types.js';

const MAX_CONCURRENT = 3;
const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10분
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const DEFAULT_DB_DIR = path.join(os.homedir(), '.vibe');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'agent-jobs.db');

type Logger = (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
type JobExecutor = (task: string, signal: AbortSignal, onProgress: (p: JobProgress) => void) => Promise<string>;

export class JobManager {
  private db: Database.Database;
  private logger: Logger;
  private runningJobs = new Map<string, AbortController>();
  private onProgress: ((chatId: string, jobId: string, progress: JobProgress) => void) | null = null;
  private onComplete: ((chatId: string, jobId: string, result: string) => void) | null = null;
  private onError: ((chatId: string, jobId: string, error: string) => void) | null = null;

  constructor(logger: Logger, dbPath?: string) {
    this.logger = logger;

    const resolvedPath = dbPath ?? DEFAULT_DB_PATH;
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initTables();
    this.startupRecovery();
    this.cleanupOldJobs();
  }

  setCallbacks(callbacks: {
    onProgress?: (chatId: string, jobId: string, progress: JobProgress) => void;
    onComplete?: (chatId: string, jobId: string, result: string) => void;
    onError?: (chatId: string, jobId: string, error: string) => void;
  }): void {
    this.onProgress = callbacks.onProgress ?? null;
    this.onComplete = callbacks.onComplete ?? null;
    this.onError = callbacks.onError ?? null;
  }

  create(chatId: string, task: string): AgentJob {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO agent_jobs (id, chatId, task, status, createdAt)
      VALUES (?, ?, ?, 'queued', ?)
    `).run(id, chatId, task, now);

    this.logger('info', `Job created: ${id}`, { chatId, task: task.substring(0, 80) });

    return {
      id, chatId, task, status: 'queued',
      progress: null, result: null, createdAt: now, completedAt: null,
    };
  }

  async start(jobId: string, executor: JobExecutor): Promise<void> {
    const job = this.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    if (this.runningJobs.size >= MAX_CONCURRENT) {
      this.logger('info', `Job queued (max concurrent ${MAX_CONCURRENT}): ${jobId}`);
      return;
    }

    const controller = new AbortController();
    this.runningJobs.set(jobId, controller);
    this.updateStatus(jobId, 'running');

    // Timeout
    const timer = setTimeout(() => {
      controller.abort();
      this.fail(jobId, 'Job timeout (10 minutes exceeded)');
    }, JOB_TIMEOUT_MS);

    try {
      const result = await executor(
        job.task,
        controller.signal,
        (progress) => this.handleProgress(jobId, job.chatId, progress),
      );

      clearTimeout(timer);
      this.complete(jobId, result);
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) return; // Already handled
      const msg = err instanceof Error ? err.message : String(err);
      this.fail(jobId, msg);
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  cancel(jobId: string): boolean {
    const controller = this.runningJobs.get(jobId);
    if (!controller) return false;

    controller.abort();
    this.updateStatus(jobId, 'cancelled');
    this.runningJobs.delete(jobId);

    const job = this.getJob(jobId);
    if (job) {
      this.onError?.(job.chatId, jobId, '작업이 취소되었습니다');
    }

    this.logger('info', `Job cancelled: ${jobId}`);
    return true;
  }

  getStatus(jobId: string): AgentJob | null {
    return this.getJob(jobId);
  }

  listActive(chatId: string): AgentJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM agent_jobs
      WHERE chatId = ? AND status IN ('queued', 'running')
      ORDER BY createdAt ASC
    `).all(chatId) as JobRow[];

    return rows.map(this.rowToJob);
  }

  getRunningCount(): number {
    return this.runningJobs.size;
  }

  close(): void {
    this.db.close();
  }

  private complete(jobId: string, result: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE agent_jobs SET status = 'completed', result = ?, completedAt = ?
      WHERE id = ?
    `).run(result, now, jobId);

    const job = this.getJob(jobId);
    if (job) {
      this.onComplete?.(job.chatId, jobId, result);
    }
    this.logger('info', `Job completed: ${jobId}`);
  }

  private fail(jobId: string, error: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE agent_jobs SET status = 'failed', result = ?, completedAt = ?
      WHERE id = ?
    `).run(error, now, jobId);

    const job = this.getJob(jobId);
    if (job) {
      this.onError?.(job.chatId, jobId, error);
    }
    this.logger('error', `Job failed: ${jobId}`, { error });
  }

  private handleProgress(jobId: string, chatId: string, progress: JobProgress): void {
    const progressJson = JSON.stringify(progress);
    this.db.prepare(`
      UPDATE agent_jobs SET progress = ? WHERE id = ?
    `).run(progressJson, jobId);

    this.onProgress?.(chatId, jobId, progress);
  }

  private updateStatus(jobId: string, status: JobStatus): void {
    this.db.prepare(`UPDATE agent_jobs SET status = ? WHERE id = ?`).run(status, jobId);
  }

  private getJob(jobId: string): AgentJob | null {
    const row = this.db.prepare(`SELECT * FROM agent_jobs WHERE id = ?`).get(jobId) as JobRow | undefined;
    return row ? this.rowToJob(row) : null;
  }

  private rowToJob(row: JobRow): AgentJob {
    return {
      id: row.id,
      chatId: row.chatId,
      task: row.task,
      status: row.status as JobStatus,
      progress: row.progress ? JSON.parse(row.progress) as JobProgress : null,
      result: row.result,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_jobs (
        id TEXT PRIMARY KEY,
        chatId TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        progress TEXT,
        result TEXT,
        createdAt TEXT NOT NULL,
        completedAt TEXT
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_chatId_status
      ON agent_jobs(chatId, status)
    `);
  }

  private startupRecovery(): void {
    const result = this.db.prepare(`
      UPDATE agent_jobs SET status = 'failed', result = 'system_restart'
      WHERE status = 'running'
    `).run();

    if (result.changes > 0) {
      this.logger('warn', `Startup recovery: ${result.changes} running jobs marked as failed`);
    }
  }

  private cleanupOldJobs(): void {
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const result = this.db.prepare(`
      DELETE FROM agent_jobs
      WHERE status IN ('completed', 'failed', 'cancelled')
      AND completedAt IS NOT NULL AND completedAt < ?
    `).run(cutoff);

    if (result.changes > 0) {
      this.logger('info', `Cleanup: removed ${result.changes} old jobs`);
    }
  }
}
