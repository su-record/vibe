/**
 * DailyReportGenerator - Daily summary report
 * Aggregates git commits, job history, and notes
 * Auto-registered with SchedulerEngine at 21:00
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';
import { NoteService } from './NoteService.js';

const execFileAsync = promisify(execFile);
const REPORT_SCHEDULE = '0 21 * * *';
const REPORT_NAME = '일일 리포트';

export interface ReportData {
  date: string;
  commits: string[];
  notes: string[];
  summary: string;
}

export class DailyReportGenerator {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;
  private noteService: NoteService | null;

  constructor(
    logger: InterfaceLogger,
    smartRouter: SmartRouterLike,
    noteService?: NoteService,
  ) {
    this.logger = logger;
    this.smartRouter = smartRouter;
    this.noteService = noteService ?? null;
  }

  /** Get the cron schedule for daily report */
  static getSchedule(): string {
    return REPORT_SCHEDULE;
  }

  /** Get the schedule name */
  static getName(): string {
    return REPORT_NAME;
  }

  /** Generate daily report */
  async generate(): Promise<ReportData> {
    const date = this.getTodayDate();
    const [commits, notes] = await Promise.all([
      this.getTodayCommits(),
      this.getTodayNotes(),
    ]);

    const rawData = this.buildRawData(date, commits, notes);
    const summary = await this.generateSummary(rawData);

    return { date, commits, notes, summary };
  }

  /** Format report for Telegram */
  static formatReport(report: ReportData): string {
    const parts: string[] = [`📊 일일 리포트 (${report.date})`];

    if (report.commits.length > 0) {
      parts.push(`\n📝 커밋 (${report.commits.length}건):`);
      parts.push(report.commits.map((c) => `  • ${c}`).join('\n'));
    }

    if (report.notes.length > 0) {
      parts.push(`\n📌 메모 (${report.notes.length}건):`);
      parts.push(report.notes.map((n) => `  • ${n.slice(0, 80)}`).join('\n'));
    }

    parts.push(`\n📋 요약:\n${report.summary}`);
    return parts.join('\n');
  }

  private async getTodayCommits(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', [
        'log', '--since=midnight', '--format=%s (%an)', '--no-merges',
      ], { timeout: 10_000 });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      this.logger('warn', 'git log 실행 실패');
      return [];
    }
  }

  private getTodayNotes(): string[] {
    if (!this.noteService) return [];
    const today = this.getTodayDate();
    const allNotes = this.noteService.list(undefined, 50);
    return allNotes
      .filter((n) => n.createdAt.startsWith(today))
      .map((n) => n.content.slice(0, 100));
  }

  private buildRawData(date: string, commits: string[], notes: string[]): string {
    const parts: string[] = [`날짜: ${date}`];
    if (commits.length > 0) {
      parts.push(`커밋:\n${commits.join('\n')}`);
    }
    if (notes.length > 0) {
      parts.push(`메모:\n${notes.join('\n')}`);
    }
    return parts.join('\n\n');
  }

  private async generateSummary(rawData: string): Promise<string> {
    if (!rawData.includes('커밋') && !rawData.includes('메모')) {
      return '오늘 기록된 활동이 없습니다.';
    }
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: REPORT_SYSTEM_PROMPT,
      prompt: rawData,
    });
    if (!result.success) return '요약 생성에 실패했습니다.';
    return result.content;
  }

  private getTodayDate(): string {
    return new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\. /g, '-').replace('.', '');
  }
}

const REPORT_SYSTEM_PROMPT = `오늘 하루의 업무 내용을 한국어로 간결하게 요약하세요.
- 주요 작업 내용
- 성과/진행 사항
- 3-5줄로 핵심만 요약`;
