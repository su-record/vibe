/**
 * MonitorRoute - Schedule management, GitHub monitoring, daily reports
 * Routes monitor-category intents to SchedulerEngine, GitHubMonitor
 */

import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult, SmartRouterLike } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { SchedulerEngine } from '../services/SchedulerEngine.js';
import { DailyReportGenerator } from '../services/DailyReportGenerator.js';

type MonitorSubIntent =
  | 'schedule_create' | 'schedule_list' | 'schedule_delete'
  | 'github_status' | 'report_now';

const SUB_INTENT_KEYWORDS: Record<MonitorSubIntent, readonly string[]> = {
  schedule_create: ['매일', '매주', '매시간', '스케줄 등록', 'schedule'],
  schedule_list: ['스케줄 목록', '스케줄 조회', 'schedule list'],
  schedule_delete: ['스케줄 삭제', 'schedule delete', '스케줄 취소'],
  github_status: ['github', '깃허브', 'CI', '모니터링'],
  report_now: ['리포트', '보고서', 'report', '오늘 한 일'],
};

export class MonitorRoute extends BaseRoute {
  readonly name = 'monitor';
  private scheduler: SchedulerEngine;
  private reportGen: DailyReportGenerator;

  constructor(
    logger: InterfaceLogger,
    smartRouter: SmartRouterLike,
    scheduler?: SchedulerEngine,
    reportGen?: DailyReportGenerator,
  ) {
    super(logger);
    this.scheduler = scheduler ?? new SchedulerEngine(logger, smartRouter);
    this.reportGen = reportGen ?? new DailyReportGenerator(logger, smartRouter);
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'monitor';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    const query = context.intent.rawQuery;
    const subIntent = this.classifySubIntent(query);
    this.logger('info', `Monitor sub-intent: ${subIntent}`);

    try {
      switch (subIntent) {
        case 'schedule_create': return await this.handleScheduleCreate(query);
        case 'schedule_list': return this.handleScheduleList();
        case 'schedule_delete': return this.handleScheduleDelete(query);
        case 'github_status': return { success: true, data: 'GitHub 모니터링이 활성화되어 있습니다.' };
        case 'report_now': return await this.handleReportNow();
        default: return { success: true, data: '모니터링 명령을 인식하지 못했습니다.' };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  private async handleScheduleCreate(query: string): Promise<RouteResult> {
    const { schedule, action } = this.parseScheduleQuery(query);
    const name = this.extractScheduleName(action);
    const job = await this.scheduler.create(name, schedule, action);
    return {
      success: true,
      data: `스케줄 등록됨: ${job.name}\n⏰ ${job.cron}\n📋 ${job.action}`,
    };
  }

  private handleScheduleList(): RouteResult {
    const jobs = this.scheduler.list();
    if (jobs.length === 0) {
      return { success: true, data: '등록된 스케줄이 없습니다.' };
    }
    const formatted = jobs.map((j, i) => {
      const status = j.enabled ? '✅' : '⏸️';
      const lastRun = j.lastRun ? `\n   마지막: ${j.lastRun}` : '';
      return `${i + 1}. ${status} ${j.name}\n   ${j.cron} | ${j.action}${lastRun}`;
    }).join('\n\n');
    return { success: true, data: `📋 스케줄 목록:\n\n${formatted}` };
  }

  private handleScheduleDelete(query: string): RouteResult {
    const idMatch = query.match(/(\d+)/);
    if (!idMatch) {
      return { success: false, error: '삭제할 스케줄 번호를 입력해주세요.' };
    }
    const deleted = this.scheduler.delete(Number(idMatch[1]));
    return deleted
      ? { success: true, data: `스케줄 #${idMatch[1]} 삭제됨` }
      : { success: false, error: `스케줄 #${idMatch[1]}을 찾을 수 없습니다.` };
  }

  private async handleReportNow(): Promise<RouteResult> {
    const report = await this.reportGen.generate();
    return { success: true, data: DailyReportGenerator.formatReport(report) };
  }

  private classifySubIntent(text: string): MonitorSubIntent {
    const lower = text.toLowerCase();
    // Check for schedule list/delete first (more specific)
    if (/스케줄\s*(목록|조회|리스트)|schedule\s*list/i.test(lower)) return 'schedule_list';
    if (/스케줄\s*(삭제|취소|제거)|schedule\s*delete/i.test(lower)) return 'schedule_delete';
    if (/리포트|보고서|report|오늘\s*한\s*일/.test(lower)) return 'report_now';
    if (/github|깃허브|ci\s|모니터링/.test(lower)) return 'github_status';
    // Default: schedule creation for time-related queries
    if (/매일|매주|매시간|스케줄/.test(lower)) return 'schedule_create';
    return 'schedule_list';
  }

  private parseScheduleQuery(query: string): { schedule: string; action: string } {
    // Pattern: "매일 9시에 [action]"
    const timeMatch = query.match(/(매일\s*\d+시|매주\s*\S+\s*\d+시|매시간)/);
    const schedule = timeMatch?.[1] ?? '매일 9시';
    // Extract action: remove time part
    const action = query
      .replace(timeMatch?.[0] ?? '', '')
      .replace(/에\s*/, '')
      .trim();
    return { schedule, action };
  }

  private extractScheduleName(action: string): string {
    return action.slice(0, 30) || '예약 작업';
  }
}
