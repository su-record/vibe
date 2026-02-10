/**
 * ProgressReporter - Telegram 진행률 보고
 * Phase 4: Async Job System
 *
 * 기능:
 * - Telegram editMessageText로 기존 메시지 업데이트
 * - editMessageText 실패 시 새 메시지 fallback
 * - Rate limiting: 최소 3초 간격
 */

import type { JobProgress } from './agent-job-types.js';

const RATE_LIMIT_MS = 3_000;

type SendFn = (chatId: string, text: string, options?: { format?: string }) => Promise<void>;
type EditFn = (chatId: string, messageId: number, text: string) => Promise<boolean>;

export class ProgressReporter {
  private sendFn: SendFn;
  private editFn: EditFn | null;
  private messageIds = new Map<string, number>(); // jobId → messageId
  private lastUpdate = new Map<string, number>(); // jobId → timestamp
  private pendingUpdates = new Map<string, { chatId: string; progress: JobProgress }>(); // buffered

  constructor(sendFn: SendFn, editFn?: EditFn) {
    this.sendFn = sendFn;
    this.editFn = editFn ?? null;
  }

  async reportStart(chatId: string, jobId: string, task: string): Promise<void> {
    const text = `🚀 작업을 시작합니다\n\n📋 ${task.substring(0, 200)}\n\n⏳ 진행 중...`;
    await this.sendFn(chatId, text);
  }

  async reportProgress(chatId: string, jobId: string, progress: JobProgress): Promise<void> {
    // Rate limiting
    const now = Date.now();
    const lastTime = this.lastUpdate.get(jobId) ?? 0;

    if (now - lastTime < RATE_LIMIT_MS) {
      this.pendingUpdates.set(jobId, { chatId, progress });
      return;
    }

    this.lastUpdate.set(jobId, now);
    this.pendingUpdates.delete(jobId);
    await this.sendProgressMessage(chatId, jobId, progress);
  }

  async reportComplete(chatId: string, jobId: string, summary: string): Promise<void> {
    // Flush any pending update
    this.pendingUpdates.delete(jobId);
    this.lastUpdate.delete(jobId);

    const text = `✅ 작업 완료\n\n${summary.substring(0, 2000)}`;
    await this.sendFn(chatId, text);

    this.messageIds.delete(jobId);
  }

  async reportError(chatId: string, jobId: string, error: string): Promise<void> {
    this.pendingUpdates.delete(jobId);
    this.lastUpdate.delete(jobId);

    const text = `❌ 작업 실패\n\n${error.substring(0, 500)}`;
    await this.sendFn(chatId, text);

    this.messageIds.delete(jobId);
  }

  async flushPending(jobId: string): Promise<void> {
    const pending = this.pendingUpdates.get(jobId);
    if (!pending) return;

    this.pendingUpdates.delete(jobId);
    this.lastUpdate.set(jobId, Date.now());
    await this.sendProgressMessage(pending.chatId, jobId, pending.progress);
  }

  private async sendProgressMessage(
    chatId: string,
    jobId: string,
    progress: JobProgress,
  ): Promise<void> {
    const bar = this.buildProgressBar(progress.percent);
    const text = `⏳ 진행 중 (${progress.phase}/${progress.totalPhases})\n\n${bar} ${progress.percent}%\n${progress.message}`;

    const existingMsgId = this.messageIds.get(jobId);

    // Try editMessageText first
    if (existingMsgId && this.editFn) {
      const edited = await this.editFn(chatId, existingMsgId, text);
      if (edited) return;
    }

    // Fallback: send new message
    await this.sendFn(chatId, text);
  }

  private buildProgressBar(percent: number): string {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  setMessageId(jobId: string, messageId: number): void {
    this.messageIds.set(jobId, messageId);
  }
}
