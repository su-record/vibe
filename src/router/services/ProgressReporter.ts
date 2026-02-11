/**
 * ProgressReporter - Telegram 실시간 진행률 보고
 * Phase 1: sonolbot-v2
 *
 * AgentProgressEvent를 Telegram 메시지 편집으로 변환.
 * chatId별 1인스턴스, 3초 최소 간격으로 rate limit 준수.
 */

import type { AgentProgressEvent } from '../../agent/types.js';
import { MESSAGING } from '../../infra/lib/constants.js';

const PROGRESS_MIN_INTERVAL_MS = MESSAGING.PROGRESS_MIN_INTERVAL_MS;

export type ProgressSendFn = (
  chatId: string,
  text: string,
) => Promise<number | undefined>;

export type ProgressEditFn = (
  chatId: string,
  messageId: number,
  text: string,
) => Promise<void>;

export interface ProgressReporterDeps {
  chatId: string;
  sendFn: ProgressSendFn;
  editFn: ProgressEditFn;
}

export class ProgressReporter {
  private chatId: string;
  private sendFn: ProgressSendFn;
  private editFn: ProgressEditFn;
  private messageId: number | undefined;
  private lastUpdate: number = 0;
  private stepCount: number = 0;
  private disposed: boolean = false;

  constructor(deps: ProgressReporterDeps) {
    this.chatId = deps.chatId;
    this.sendFn = deps.sendFn;
    this.editFn = deps.editFn;
  }

  async handleProgressEvent(event: AgentProgressEvent): Promise<void> {
    if (this.disposed) return;

    switch (event.type) {
      case 'job:created':
        await this.onJobCreated();
        break;
      case 'job:progress':
        await this.onProgress(event);
        break;
      case 'job:complete':
        await this.onComplete();
        this.dispose();
        break;
      case 'job:error':
        await this.onError();
        this.dispose();
        break;
      // job:chunk ignored (streaming text is unsuitable for Telegram)
    }
  }

  dispose(): void {
    this.disposed = true;
    this.messageId = undefined;
    this.lastUpdate = 0;
    this.stepCount = 0;
  }

  private async onJobCreated(): Promise<void> {
    this.messageId = await this.sendFn(this.chatId, '🔄 작업을 시작합니다');
  }

  private async onProgress(event: AgentProgressEvent): Promise<void> {
    if (!this.messageId) return;

    const now = Date.now();
    if (now - this.lastUpdate < PROGRESS_MIN_INTERVAL_MS) return;

    const data = event.data;
    if (data.kind === 'tool_start') {
      this.stepCount++;
      await this.editFn(
        this.chatId,
        this.messageId,
        `🔄 ${this.stepCount}단계: ${data.toolName} 실행 중...`,
      );
      this.lastUpdate = now;
    } else if (data.kind === 'tool_end') {
      await this.editFn(
        this.chatId,
        this.messageId,
        `🔄 ${this.stepCount}단계 완료`,
      );
      this.lastUpdate = now;
    }
  }

  private async onComplete(): Promise<void> {
    if (!this.messageId) return;
    await this.editFn(this.chatId, this.messageId, '✅ 완료!');
  }

  private async onError(): Promise<void> {
    if (!this.messageId) return;
    await this.editFn(this.chatId, this.messageId, '❌ 오류 발생');
  }
}
