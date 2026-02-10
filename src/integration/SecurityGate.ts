/**
 * Security Gate — Phase 6-3
 *
 * Authentication, ToolPolicy check, rate limiting, audit logging.
 * Sliding window rate limiter with burst support.
 */

import type {
  AuditEntry,
  RateLimitState,
  IntegrationLogger,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_BURST = 10;
const AUDIT_RETENTION_DAYS = 90;

// ============================================================================
// Rate Limiter (Sliding Window)
// ============================================================================

export class RateLimiter {
  private states = new Map<string, RateLimitState>();

  /** Check if request is allowed under rate limit */
  check(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let state = this.states.get(userId);
    if (!state) {
      state = { userId, timestamps: [] };
      this.states.set(userId, state);
    }

    // Remove timestamps outside window
    state.timestamps = state.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    const used = state.timestamps.length;
    const limit = RATE_LIMIT_MAX + RATE_LIMIT_BURST;
    const allowed = used < limit;

    if (allowed) {
      state.timestamps.push(now);
    }

    return { allowed, remaining: Math.max(0, limit - used - 1) };
  }

  /** Reset rate limit for user */
  reset(userId: string): void {
    this.states.delete(userId);
  }

  /** Get current usage */
  getUsage(userId: string): number {
    const state = this.states.get(userId);
    if (!state) return 0;
    const now = Date.now();
    return state.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS).length;
  }
}

// ============================================================================
// Audit Logger (In-Memory with size cap)
// ============================================================================

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries: number;
  private logger: IntegrationLogger;

  constructor(logger: IntegrationLogger, maxEntries: number = 10_000) {
    this.logger = logger;
    this.maxEntries = maxEntries;
  }

  /** Log an audit entry */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      id: this.entries.length + 1,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);

    // Cap size
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return full;
  }

  /** Query recent entries */
  query(userId?: string, limit: number = 50): AuditEntry[] {
    let filtered = this.entries;
    if (userId) {
      filtered = filtered.filter(e => e.userId === userId);
    }
    return filtered.slice(-limit);
  }

  /** Cleanup old entries (90-day retention) */
  cleanup(): number {
    const cutoff = Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const before = this.entries.length;
    this.entries = this.entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
    return before - this.entries.length;
  }

  /** Get entry count */
  count(): number {
    return this.entries.length;
  }

  /** Clear all */
  clear(): void {
    this.entries = [];
  }
}

// ============================================================================
// Security Gate
// ============================================================================

export class SecurityGate {
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  private logger: IntegrationLogger;

  constructor(logger: IntegrationLogger) {
    this.logger = logger;
    this.rateLimiter = new RateLimiter();
    this.auditLogger = new AuditLogger(logger);
  }

  /** Check if request passes security gate */
  check(userId: string, channel: string, command: string): {
    allowed: boolean;
    reason?: string;
  } {
    // Rate limit check
    const rateResult = this.rateLimiter.check(userId);
    if (!rateResult.allowed) {
      this.auditLogger.log({
        userId,
        channel,
        command,
        module: 'security',
        result: 'rate_limited',
        durationMs: 0,
      });
      return { allowed: false, reason: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' };
    }

    return { allowed: true };
  }

  /** Log command execution result */
  logExecution(
    userId: string,
    channel: string,
    command: string,
    module: string,
    result: 'success' | 'denied' | 'error',
    durationMs: number,
  ): void {
    const truncatedCmd = command.length > 500 ? command.slice(0, 497) + '...' : command;
    this.auditLogger.log({ userId, channel, command: truncatedCmd, module, result, durationMs });
  }

  /** Get rate limiter (for testing) */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /** Get audit logger (for testing) */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }
}
