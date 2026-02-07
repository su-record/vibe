/**
 * SchedulerEngine - node-cron based scheduled task management
 * Natural language → cron conversion via LLM
 * SQLite persistence for schedule recovery on restart
 */

import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { InterfaceLogger } from '../../interface/types.js';
import { ModelARouterInterface, SmartRouterLike } from '../types.js';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.vibe', 'schedules.db');
const TIMEZONE = 'Asia/Seoul';
const GRACEFUL_SHUTDOWN_MS = 30_000;

export interface ScheduleJob {
  id: number;
  name: string;
  cron: string;
  action: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

type CronTask = { stop: () => void };

export class SchedulerEngine {
  private db: Database.Database;
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;
  private router: ModelARouterInterface | null = null;
  private chatId: string | null = null;
  private activeTasks: Map<number, CronTask> = new Map();
  private runningJobs: Set<number> = new Set();
  private cronModule: typeof import('node-cron') | null = null;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike, dbPath?: string) {
    this.logger = logger;
    this.smartRouter = smartRouter;
    const resolvedPath = dbPath ?? DEFAULT_DB_PATH;
    this.ensureDir(resolvedPath);
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  /** Set the router and chat ID for executing scheduled actions */
  setRouter(router: ModelARouterInterface, chatId: string): void {
    this.router = router;
    this.chatId = chatId;
  }

  /** Create a new schedule from natural language */
  async create(name: string, naturalSchedule: string, action: string): Promise<ScheduleJob> {
    const cron = await this.naturalToCron(naturalSchedule);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'INSERT INTO schedules (name, cron, action, enabled, lastRun, nextRun, createdAt) VALUES (?, ?, ?, 1, NULL, NULL, ?)',
    );
    const result = stmt.run(name, cron, action, now);
    const job = this.getById(Number(result.lastInsertRowid))!;
    this.startCronTask(job);
    this.logger('info', `스케줄 등록: ${name} (${cron})`);
    return job;
  }

  /** Create schedule with explicit cron expression */
  createWithCron(name: string, cron: string, action: string): ScheduleJob {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      'INSERT INTO schedules (name, cron, action, enabled, lastRun, nextRun, createdAt) VALUES (?, ?, ?, 1, NULL, NULL, ?)',
    );
    const result = stmt.run(name, cron, action, now);
    const job = this.getById(Number(result.lastInsertRowid))!;
    this.startCronTask(job);
    return job;
  }

  /** List all schedules */
  list(): ScheduleJob[] {
    return this.db.prepare('SELECT * FROM schedules ORDER BY createdAt DESC').all() as ScheduleJob[];
  }

  /** Delete a schedule */
  delete(id: number): boolean {
    this.stopCronTask(id);
    const result = this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /** Toggle schedule enabled/disabled */
  toggle(id: number): ScheduleJob | null {
    const job = this.getById(id);
    if (!job) return null;
    const newEnabled = job.enabled ? 0 : 1;
    this.db.prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(newEnabled, id);
    if (newEnabled) {
      this.startCronTask({ ...job, enabled: true });
    } else {
      this.stopCronTask(id);
    }
    return this.getById(id);
  }

  /** Restore schedules from DB on startup */
  async restoreAll(): Promise<number> {
    await this.loadCronModule();
    const jobs = this.db.prepare('SELECT * FROM schedules WHERE enabled = 1').all() as ScheduleJob[];
    for (const job of jobs) {
      this.startCronTask(job);
    }
    this.logger('info', `${jobs.length}개 스케줄 복원 완료`);
    return jobs.length;
  }

  /** Graceful shutdown - wait for running jobs */
  async shutdown(): Promise<void> {
    for (const [id] of this.activeTasks) {
      this.stopCronTask(id);
    }
    if (this.runningJobs.size > 0) {
      this.logger('info', `${this.runningJobs.size}개 실행 중 작업 완료 대기...`);
      const deadline = Date.now() + GRACEFUL_SHUTDOWN_MS;
      while (this.runningJobs.size > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    this.db.close();
  }

  /** Convert natural language to cron expression via LLM */
  async naturalToCron(text: string): Promise<string> {
    const quick = this.tryQuickParse(text);
    if (quick) return quick;
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: CRON_SYSTEM_PROMPT,
      prompt: text,
    });
    if (!result.success) throw new Error('스케줄 해석에 실패했습니다.');
    const cronMatch = result.content.match(/[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+/);
    if (!cronMatch) throw new Error('유효한 cron 표현식을 생성하지 못했습니다.');
    return cronMatch[0].trim();
  }

  private tryQuickParse(text: string): string | null {
    if (/매일\s*(\d+)시/.test(text)) {
      const hour = text.match(/매일\s*(\d+)시/)![1];
      return `0 ${hour} * * *`;
    }
    if (/매시간/.test(text)) return '0 * * * *';
    if (/매주\s*월.*?(\d+)시/.test(text)) {
      const hour = text.match(/(\d+)시/)![1];
      return `0 ${hour} * * 1`;
    }
    return null;
  }

  private getById(id: number): ScheduleJob | null {
    return (this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleJob) ?? null;
  }

  private async loadCronModule(): Promise<void> {
    if (this.cronModule) return;
    const moduleName = 'node-cron';
    this.cronModule = await import(/* webpackIgnore: true */ moduleName);
  }

  private startCronTask(job: ScheduleJob): void {
    if (!this.cronModule || !job.enabled) return;
    this.stopCronTask(job.id);
    const task = this.cronModule.schedule(job.cron, () => this.executeJob(job), {
      timezone: TIMEZONE,
    });
    this.activeTasks.set(job.id, task);
  }

  private stopCronTask(id: number): void {
    const task = this.activeTasks.get(id);
    if (task) {
      task.stop();
      this.activeTasks.delete(id);
    }
  }

  private async executeJob(job: ScheduleJob): Promise<void> {
    if (!this.router || !this.chatId) {
      this.logger('warn', `스케줄 실행 불가: router/chatId 미설정 (${job.name})`);
      return;
    }
    this.runningJobs.add(job.id);
    try {
      this.logger('info', `스케줄 실행: ${job.name}`);
      await this.router.handleMessage({
        id: `sched-${job.id}-${Date.now()}`,
        channel: 'telegram',
        chatId: this.chatId,
        userId: 'scheduler',
        content: job.action,
        type: 'text',
        metadata: { scheduledJob: job.id },
        timestamp: new Date().toISOString(),
      });
      this.db.prepare('UPDATE schedules SET lastRun = ? WHERE id = ?')
        .run(new Date().toISOString(), job.id);
    } catch (err) {
      this.logger('error', `스케줄 실행 실패: ${job.name}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        action TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        lastRun TEXT,
        nextRun TEXT,
        createdAt TEXT NOT NULL
      );
    `);
  }

  private ensureDir(dbPath: string): void {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

const CRON_SYSTEM_PROMPT = `cron 표현식 변환 전문가입니다. 자연어를 5-field cron 표현식으로 변환하세요.
형식: 분 시 일 월 요일
예시: "매일 9시" → "0 9 * * *", "매주 월요일 10시" → "0 10 * * 1"
cron 표현식만 반환하세요.`;
