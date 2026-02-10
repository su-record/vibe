/**
 * Session Context — Phase 6-2
 *
 * Cross-module session context for sharing results between modules.
 * Per-user context with 30-minute TTL and 10-entry history.
 */

import type {
  ContextEntry,
  UserSession,
  IntentCategory,
  IntegrationLogger,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY = 10;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Session Context Manager
// ============================================================================

export class SessionContextManager {
  private sessions = new Map<string, UserSession>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private logger: IntegrationLogger;

  constructor(logger: IntegrationLogger) {
    this.logger = logger;
    this.startCleanup();
  }

  /** Get or create session for user + channel */
  getSession(userId: string, channel: string): UserSession {
    const key = `${userId}:${channel}`;
    let session = this.sessions.get(key);
    if (!session) {
      session = {
        userId,
        channel,
        history: [],
        lastActivityAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.sessions.set(key, session);
    }
    session.lastActivityAt = new Date().toISOString();
    return session;
  }

  /** Add a result entry to session history */
  addEntry(userId: string, channel: string, entry: Omit<ContextEntry, 'timestamp'>): void {
    const session = this.getSession(userId, channel);
    session.history.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    // Keep only recent entries
    if (session.history.length > MAX_HISTORY) {
      session.history = session.history.slice(-MAX_HISTORY);
    }
  }

  /** Get last result from a specific module */
  getLastResult(userId: string, channel: string, module: IntentCategory): ContextEntry | undefined {
    const session = this.getSession(userId, channel);
    for (let i = session.history.length - 1; i >= 0; i--) {
      if (session.history[i].module === module) {
        return session.history[i];
      }
    }
    return undefined;
  }

  /** Get recent history */
  getHistory(userId: string, channel: string): ContextEntry[] {
    return this.getSession(userId, channel).history;
  }

  /** Clear session */
  clear(userId: string, channel: string): void {
    this.sessions.delete(`${userId}:${channel}`);
  }

  /** Get active session count */
  getActiveCount(): number {
    return this.sessions.size;
  }

  /** Cleanup expired sessions */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, session] of this.sessions) {
      const idle = now - new Date(session.lastActivityAt).getTime();
      if (idle > SESSION_TTL_MS) {
        this.sessions.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger('debug', `Cleaned ${removed} expired sessions`);
    }
    return removed;
  }

  /** Shutdown */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.sessions.clear();
  }

  // ============================================================================
  // Private
  // ============================================================================

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }
}
