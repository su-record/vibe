import type { ConfirmationRow } from './ConfirmationStore.js';

const CHANNEL_TIMEOUT_MS = 10_000;
const SPAM_WINDOW_MS = 300_000;
const MAX_SPAM_COUNT = 3;

export interface NotificationChannel {
  readonly name: string;
  send(confirmation: ConfirmationRow, message: string): Promise<boolean>;
}

export interface NotificationResult {
  success: boolean;
  channel: string | null;
  error?: string;
}

interface DedupeEntry {
  count: number;
  firstAt: number;
}

export class NotificationDispatcher {
  private readonly channels: NotificationChannel[];
  private readonly dedupeMap = new Map<string, DedupeEntry>();

  constructor(channels: NotificationChannel[]) {
    this.channels = channels;
  }

  async notify(confirmation: ConfirmationRow): Promise<NotificationResult> {
    const dedupeKey = `${confirmation.actionType}:${confirmation.riskLevel}`;
    if (this.isSpam(dedupeKey)) {
      return {
        success: false,
        channel: null,
        error: 'Notification rate limit exceeded (max 3 per 5 minutes)',
      };
    }

    const message = this.formatMessage(confirmation);

    for (const channel of this.channels) {
      try {
        const sent = await this.sendWithTimeout(channel, confirmation, message);
        if (sent) {
          this.trackSend(dedupeKey);
          return { success: true, channel: channel.name };
        }
      } catch {
        // Fallback to next channel
      }
    }

    return {
      success: false,
      channel: null,
      error: 'All notification channels failed',
    };
  }

  formatMessage(confirmation: ConfirmationRow): string {
    const factors = this.parseFactors(confirmation.riskFactors);
    const expiresIn = this.calculateExpiresIn(confirmation.expiresAt);
    return [
      'Security Sentinel — Confirmation Required',
      '',
      `Action: ${confirmation.actionType}`,
      `Risk: ${confirmation.riskLevel} (${confirmation.riskScore}/100)`,
      `Summary: ${confirmation.actionSummary}`,
      `Factors: ${factors.join(', ')}`,
      '',
      `Expires in: ${expiresIn}`,
      '',
      '[Approve] [Reject]',
    ].join('\n');
  }

  getChannelCount(): number {
    return this.channels.length;
  }

  private async sendWithTimeout(
    channel: NotificationChannel,
    confirmation: ConfirmationRow,
    message: string,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Channel ${channel.name} timed out`));
      }, CHANNEL_TIMEOUT_MS);

      channel
        .send(confirmation, message)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private isSpam(dedupeKey: string): boolean {
    const entry = this.dedupeMap.get(dedupeKey);
    if (!entry) return false;
    if (Date.now() - entry.firstAt > SPAM_WINDOW_MS) {
      this.dedupeMap.delete(dedupeKey);
      return false;
    }
    return entry.count >= MAX_SPAM_COUNT;
  }

  private trackSend(dedupeKey: string): void {
    const entry = this.dedupeMap.get(dedupeKey);
    if (!entry || Date.now() - entry.firstAt > SPAM_WINDOW_MS) {
      this.dedupeMap.set(dedupeKey, { count: 1, firstAt: Date.now() });
    } else {
      entry.count++;
    }
  }

  private parseFactors(factorsJson: string): string[] {
    try {
      return JSON.parse(factorsJson) as string[];
    } catch {
      return [];
    }
  }

  private calculateExpiresIn(expiresAt: string): string {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return 'expired';
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
