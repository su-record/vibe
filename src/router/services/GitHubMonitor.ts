/**
 * GitHubMonitor - GitHub event monitoring + Telegram notification
 * Processes webhook events: CI failures, PR review requests
 */

import { InterfaceLogger } from '../../interface/types.js';
import { NotificationManager } from '../notifications/NotificationManager.js';
import { NotificationPriority } from '../notifications/NotificationManager.js';

export interface GitHubEvent {
  type: string;
  action?: string;
  repository: { full_name: string };
  payload: Record<string, unknown>;
}

export interface MonitorConfig {
  repos: string[];
  events: string[];
}

const DEFAULT_EVENTS = ['workflow_run.completed', 'pull_request.review_requested'];

export class GitHubMonitor {
  private logger: InterfaceLogger;
  private notificationMgr: NotificationManager;
  private chatId: string;
  private config: MonitorConfig;

  constructor(
    logger: InterfaceLogger,
    notificationMgr: NotificationManager,
    chatId: string,
    config?: Partial<MonitorConfig>,
  ) {
    this.logger = logger;
    this.notificationMgr = notificationMgr;
    this.chatId = chatId;
    this.config = {
      repos: config?.repos ?? [],
      events: config?.events ?? DEFAULT_EVENTS,
    };
  }

  /** Process a GitHub webhook event */
  async processEvent(event: GitHubEvent): Promise<boolean> {
    const repo = event.repository.full_name;
    if (!this.isMonitoredRepo(repo)) return false;

    const eventKey = event.action ? `${event.type}.${event.action}` : event.type;
    if (!this.isMonitoredEvent(eventKey)) return false;

    const notification = this.formatNotification(event, eventKey);
    if (!notification) return false;

    const priority = this.getPriority(eventKey);
    await this.notificationMgr.send(this.chatId, notification, priority);
    this.logger('info', `GitHub 알림 전송: ${eventKey} (${repo})`);
    return true;
  }

  /** Format notification message based on event type */
  formatNotification(event: GitHubEvent, eventKey: string): string | null {
    const repo = event.repository.full_name;
    const payload = event.payload;

    if (eventKey === 'workflow_run.completed') {
      return this.formatWorkflowRun(repo, payload);
    }
    if (eventKey === 'pull_request.review_requested') {
      return this.formatPRReviewRequest(repo, payload);
    }
    return `[${repo}] ${eventKey}`;
  }

  /** Check if repo is in monitored list (empty = all) */
  isMonitoredRepo(repo: string): boolean {
    if (this.config.repos.length === 0) return true;
    return this.config.repos.some((r) => repo.includes(r));
  }

  /** Check if event is in monitored list */
  isMonitoredEvent(eventKey: string): boolean {
    return this.config.events.includes(eventKey);
  }

  private formatWorkflowRun(repo: string, payload: Record<string, unknown>): string | null {
    const conclusion = payload.conclusion as string;
    if (conclusion === 'success') return null;
    const workflowName = (payload.name as string) ?? 'unknown';
    const commitMsg = this.extractCommitMessage(payload);
    return `[${repo}] CI 실패: ${workflowName} - ${commitMsg}`;
  }

  private formatPRReviewRequest(repo: string, payload: Record<string, unknown>): string {
    const pr = payload.pull_request as Record<string, unknown> | undefined;
    const number = (pr?.number ?? payload.number ?? '?') as number;
    const title = (pr?.title ?? payload.title ?? '(제목 없음)') as string;
    return `[${repo}] PR #${number} 리뷰 요청: ${title}`;
  }

  private extractCommitMessage(payload: Record<string, unknown>): string {
    const headCommit = payload.head_commit as Record<string, unknown> | undefined;
    return (headCommit?.message as string)?.split('\n')[0] ?? '(커밋 메시지 없음)';
  }

  private getPriority(eventKey: string): NotificationPriority {
    if (eventKey === 'workflow_run.completed') return 'urgent';
    return 'normal';
  }
}
