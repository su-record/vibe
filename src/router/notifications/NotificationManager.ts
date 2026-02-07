/**
 * NotificationManager - Telegram notification management
 * Rate limiting, quiet hours, priority levels
 */

import { InterfaceLogger } from '../../interface/types.js';
import { NotificationConfig, RouteServices } from '../types.js';

export type NotificationPriority = 'urgent' | 'normal' | 'low';

interface PendingNotification {
  chatId: string;
  text: string;
  priority: NotificationPriority;
  queuedAt: number;
}

const DEFAULT_MIN_INTERVAL_MS = 10_000;
const LOW_PRIORITY_BATCH_MS = 3_600_000; // 1 hour

export class NotificationManager {
  private logger: InterfaceLogger;
  private config: NotificationConfig;
  private lastSentMap: Map<string, number> = new Map();
  private lowPriorityQueue: PendingNotification[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private sendFn: ((chatId: string, text: string) => Promise<void>) | null = null;

  constructor(logger: InterfaceLogger, config: NotificationConfig) {
    this.logger = logger;
    this.config = config;
  }

  /** Set the send function (deferred initialization) */
  setSendFunction(fn: (chatId: string, text: string) => Promise<void>): void {
    this.sendFn = fn;
  }

  /** Send a notification with rate limiting and quiet hours */
  async send(
    chatId: string,
    text: string,
    priority: NotificationPriority = 'normal',
  ): Promise<boolean> {
    if (!this.sendFn) {
      this.logger('warn', 'NotificationManager: send function not set');
      return false;
    }

    // Urgent: always send (bypass quiet hours)
    if (priority === 'urgent') {
      return this.doSend(chatId, text);
    }

    // Low priority: queue for batch
    if (priority === 'low') {
      this.queueLowPriority(chatId, text);
      return true;
    }

    // Normal: check quiet hours and rate limit
    if (this.isQuietHours()) return false;
    if (!this.isRateLimitOk(chatId)) return false;

    return this.doSend(chatId, text);
  }

  /** Send completion notification (always immediate) */
  async sendCompletion(chatId: string, text: string): Promise<boolean> {
    return this.doSend(chatId, text);
  }

  /** Start the low-priority batch timer */
  startBatchTimer(): void {
    if (this.batchTimer) return;
    this.batchTimer = setInterval(() => this.flushLowPriority(), LOW_PRIORITY_BATCH_MS);
  }

  /** Stop and cleanup */
  stop(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /** Check if within quiet hours (23:00~07:00) */
  private isQuietHours(): boolean {
    const hour = new Date().getHours();
    const { quietHoursStart, quietHoursEnd } = this.config;
    if (quietHoursStart > quietHoursEnd) {
      return hour >= quietHoursStart || hour < quietHoursEnd;
    }
    return hour >= quietHoursStart && hour < quietHoursEnd;
  }

  /** Check rate limit (min interval between messages) */
  private isRateLimitOk(chatId: string): boolean {
    const lastSent = this.lastSentMap.get(chatId) ?? 0;
    const minInterval = this.config.minIntervalMs || DEFAULT_MIN_INTERVAL_MS;
    return Date.now() - lastSent >= minInterval;
  }

  /** Actually send a message */
  private async doSend(chatId: string, text: string): Promise<boolean> {
    if (!this.sendFn) return false;
    try {
      await this.sendFn(chatId, text);
      this.lastSentMap.set(chatId, Date.now());
      return true;
    } catch (err) {
      this.logger('error', 'Failed to send notification', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /** Queue low-priority notification for batch sending */
  private queueLowPriority(chatId: string, text: string): void {
    this.lowPriorityQueue.push({
      chatId,
      text,
      priority: 'low',
      queuedAt: Date.now(),
    });
  }

  /** Flush low-priority queue as batch summary */
  private async flushLowPriority(): Promise<void> {
    if (this.lowPriorityQueue.length === 0) return;

    const grouped = new Map<string, string[]>();
    for (const item of this.lowPriorityQueue) {
      const existing = grouped.get(item.chatId) ?? [];
      existing.push(item.text);
      grouped.set(item.chatId, existing);
    }

    this.lowPriorityQueue = [];

    for (const [chatId, texts] of grouped) {
      const summary = `📋 알림 요약 (${texts.length}건):\n${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
      await this.doSend(chatId, summary);
    }
  }
}
