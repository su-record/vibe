import type { AgentActionEvent } from './schemas.js';
import type { EventBus } from './EventBus.js';
import type { RiskAssessment } from './RiskClassifier.js';
import { ConfirmationStore, InvalidTransitionError } from './ConfirmationStore.js';
import type { ConfirmationRow, CreateConfirmationInput } from './ConfirmationStore.js';
import { NotificationDispatcher } from './NotificationDispatcher.js';
import type { NotificationChannel } from './NotificationDispatcher.js';

const CHECK_EXPIRED_INTERVAL_MS = 60_000;
const MAX_PENDING = 10;
const DEFAULT_TIMEOUT_S = 300;

export interface ConfirmationResult {
  id: string;
  status: 'approved' | 'rejected' | 'expired' | 'cancelled';
  response?: string;
}

interface PendingEntry {
  resolve: (result: ConfirmationResult) => void;
  timerId: ReturnType<typeof setTimeout>;
}

interface StorageProvider {
  getDatabase(): import('better-sqlite3').Database;
}

export class ConfirmationManager {
  private readonly store: ConfirmationStore;
  private readonly dispatcher: NotificationDispatcher;
  private readonly eventBus: EventBus;
  private readonly pending = new Map<string, PendingEntry>();
  private expiryCheckId: ReturnType<typeof setInterval> | null = null;
  private readonly timeoutSeconds: number;

  constructor(deps: {
    storage: StorageProvider;
    eventBus: EventBus;
    channels: NotificationChannel[];
    timeoutSeconds?: number;
  }) {
    this.store = new ConfirmationStore(deps.storage);
    this.dispatcher = new NotificationDispatcher(deps.channels);
    this.eventBus = deps.eventBus;
    this.timeoutSeconds = deps.timeoutSeconds ?? DEFAULT_TIMEOUT_S;
  }

  async requestConfirmation(
    action: AgentActionEvent,
    riskAssessment: RiskAssessment,
  ): Promise<ConfirmationResult> {
    this.enforceMaxPending();

    const input: CreateConfirmationInput = {
      correlationId: action.correlationId ?? `confirm-${Date.now()}`,
      actionType: action.actionType,
      actionSummary: `${action.actionType} on ${action.target}`,
      riskLevel: riskAssessment.riskLevel,
      riskScore: riskAssessment.score,
      riskFactors: riskAssessment.factors,
      timeoutSeconds: this.timeoutSeconds,
      idempotencyKey: `${action.actionType}:${action.target}:${riskAssessment.riskLevel}`,
    };

    const confirmation = this.store.create(input);

    if (confirmation.status !== 'pending') {
      return {
        id: confirmation.id,
        status: confirmation.status as ConfirmationResult['status'],
        response: confirmation.ownerResponse ?? undefined,
      };
    }

    const notifyResult = await this.dispatcher.notify(confirmation);

    if (notifyResult.success && notifyResult.channel) {
      this.store.updateChannel(confirmation.id, notifyResult.channel);
    }

    if (!notifyResult.success) {
      const expired = this.store.resolve(confirmation.id, 'expired', 'All notification channels failed');
      this.emitResolved(expired);
      return { id: expired.id, status: 'expired', response: expired.ownerResponse ?? undefined };
    }

    this.emitRequested(confirmation);

    return this.waitForResponse(confirmation);
  }

  handleResponse(confirmationId: string, approved: boolean, response?: string): ConfirmationResult {
    const status = approved ? 'approved' : 'rejected';
    const resolved = this.store.resolve(confirmationId, status, response);
    this.emitResolved(resolved);
    this.resolvePending(confirmationId, {
      id: resolved.id,
      status: resolved.status as ConfirmationResult['status'],
      response: resolved.ownerResponse ?? undefined,
    });
    return {
      id: resolved.id,
      status: resolved.status as ConfirmationResult['status'],
      response: resolved.ownerResponse ?? undefined,
    };
  }

  checkExpired(): number {
    const expired = this.store.getExpired();
    let count = 0;
    for (const row of expired) {
      try {
        const resolved = this.store.resolve(row.id, 'expired', 'Confirmation timeout');
        this.emitResolved(resolved);
        this.resolvePending(row.id, { id: row.id, status: 'expired', response: 'Confirmation timeout' });
        count++;
      } catch (err) {
        if (!(err instanceof InvalidTransitionError)) throw err;
      }
    }
    return count;
  }

  loadPendingOnStartup(): void {
    const pendingRows = this.store.getPending();
    const now = Date.now();

    for (const row of pendingRows) {
      const expiresAt = new Date(row.expiresAt).getTime();
      if (expiresAt <= now) {
        try {
          this.store.resolve(row.id, 'expired', 'Expired during restart');
        } catch {
          // Already transitioned
        }
      }
    }
  }

  startExpiryCheck(): void {
    this.expiryCheckId = setInterval(() => {
      this.checkExpired();
    }, CHECK_EXPIRED_INTERVAL_MS);
  }

  stopExpiryCheck(): void {
    if (this.expiryCheckId) {
      clearInterval(this.expiryCheckId);
      this.expiryCheckId = null;
    }
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timerId);
      entry.resolve({ id, status: 'cancelled' });
    }
    this.pending.clear();
  }

  getStore(): ConfirmationStore {
    return this.store;
  }

  getPendingCount(): number {
    return this.store.getPendingCount();
  }

  private waitForResponse(confirmation: ConfirmationRow): Promise<ConfirmationResult> {
    return new Promise<ConfirmationResult>((resolve) => {
      const remaining = new Date(confirmation.expiresAt).getTime() - Date.now();
      const timerId = setTimeout(() => {
        this.pending.delete(confirmation.id);
        try {
          const expired = this.store.resolve(confirmation.id, 'expired', 'Confirmation timeout');
          this.emitResolved(expired);
          resolve({ id: expired.id, status: 'expired', response: 'Confirmation timeout' });
        } catch {
          const current = this.store.getById(confirmation.id);
          resolve({
            id: confirmation.id,
            status: (current?.status ?? 'expired') as ConfirmationResult['status'],
          });
        }
      }, Math.max(remaining, 0));

      this.pending.set(confirmation.id, { resolve, timerId });
    });
  }

  private resolvePending(id: string, result: ConfirmationResult): void {
    const entry = this.pending.get(id);
    if (entry) {
      clearTimeout(entry.timerId);
      this.pending.delete(id);
      entry.resolve(result);
    }
  }

  private enforceMaxPending(): void {
    const pendingCount = this.store.getPendingCount();
    if (pendingCount >= MAX_PENDING) {
      const expired = this.store.getExpired();
      if (expired.length === 0) {
        const oldest = this.store.getPending();
        if (oldest.length > 0) {
          try {
            this.store.resolve(oldest[0].id, 'expired', 'Max pending limit exceeded');
          } catch {
            // Already transitioned
          }
        }
      }
    }
  }

  private emitRequested(confirmation: ConfirmationRow): void {
    try {
      this.eventBus.emit('confirmation_requested', {
        actionId: confirmation.id,
        channel: confirmation.channel ?? 'unknown',
        status: 'PENDING_APPROVAL',
        expiresAt: confirmation.expiresAt,
      });
    } catch {
      // Non-critical
    }
  }

  private emitResolved(confirmation: ConfirmationRow): void {
    try {
      const statusMap: Record<string, string> = {
        approved: 'APPROVED',
        rejected: 'REJECTED',
        expired: 'EXPIRED',
        cancelled: 'EXPIRED',
      };
      this.eventBus.emit('confirmation_resolved', {
        actionId: confirmation.id,
        channel: confirmation.channel ?? 'unknown',
        status: (statusMap[confirmation.status] ?? 'EXPIRED') as 'APPROVED' | 'REJECTED' | 'EXPIRED',
        ownerResponse: confirmation.ownerResponse ?? undefined,
        expiresAt: confirmation.expiresAt,
      });
    } catch {
      // Non-critical
    }
  }
}
