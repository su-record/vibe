/**
 * DevSessionManager - ClaudeCodeBridge session management
 * Session key: chatId:projectPath
 * Reuses existing sessions, auto-cleanup on idle
 */

import { ClaudeCodeBridge } from '../../interface/ClaudeCodeBridge.js';
import { InterfaceLogger } from '../../interface/types.js';

import { MESSAGING } from '../../infra/lib/constants.js';

const MAX_CONCURRENT_SESSIONS = 3;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RETRIES = 3;
const LOCK_WAIT_TIMEOUT_MS = MESSAGING.LOCK_WAIT_TIMEOUT_MS;

interface DevSession {
  key: string;
  chatId: string;
  projectPath: string;
  bridge: ClaudeCodeBridge;
  lastActivity: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export class DevSessionManager {
  private sessions: Map<string, DevSession> = new Map();
  private logger: InterfaceLogger;
  private maxSessions: number;
  private locks: Map<string, Promise<void>> = new Map();

  constructor(logger: InterfaceLogger, maxSessions: number = MAX_CONCURRENT_SESSIONS) {
    this.logger = logger;
    this.maxSessions = maxSessions;
  }

  /** Phase 3: Async mutex — serialize concurrent access per key */
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.locks.get(key);

    // Wait for existing lock with timeout
    if (existing) {
      await Promise.race([
        existing,
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Lock timeout for key: ${key}`)),
            LOCK_WAIT_TIMEOUT_MS,
          ),
        ),
      ]);
    }

    let resolve: () => void;
    const lockPromise = new Promise<void>((r) => { resolve = r; });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      resolve!();
      this.locks.delete(key);
    }
  }

  /** Get or create a session for chatId + projectPath */
  async getSession(chatId: string, projectPath: string): Promise<ClaudeCodeBridge> {
    const key = this.makeKey(chatId, projectPath);

    return this.withLock(key, async () => {
      // Reuse existing session
      const existing = this.sessions.get(key);
      if (existing && existing.bridge.isRunning()) {
        this.touchSession(existing);
        return existing.bridge;
      }

      // Evict oldest if at capacity
      if (this.sessions.size >= this.maxSessions) {
        this.evictOldest();
      }

      // Create new session
      return this.createSession(key, chatId, projectPath);
    });
  }

  /** Check if a session exists */
  hasSession(chatId: string, projectPath: string): boolean {
    const key = this.makeKey(chatId, projectPath);
    const session = this.sessions.get(key);
    return !!session && session.bridge.isRunning();
  }

  /** Close a specific session */
  async closeSession(chatId: string, projectPath: string): Promise<void> {
    const key = this.makeKey(chatId, projectPath);
    const session = this.sessions.get(key);
    if (!session) return;

    await this.destroySession(session);
    this.sessions.delete(key);
  }

  /** Close all sessions (for shutdown) */
  async closeAll(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((s) => this.destroySession(s)));
    this.logger('info', 'All dev sessions closed');
  }

  /** Get active session count */
  get activeCount(): number {
    return this.sessions.size;
  }

  /** Create session key */
  private makeKey(chatId: string, projectPath: string): string {
    return `${chatId}:${projectPath}`;
  }

  /** Create a new ClaudeCodeBridge session */
  private async createSession(
    key: string,
    chatId: string,
    projectPath: string,
  ): Promise<ClaudeCodeBridge> {
    const bridge = new ClaudeCodeBridge(
      { projectPath, maxRetries: MAX_RETRIES },
      this.logger,
    );

    await bridge.start();

    const session: DevSession = {
      key,
      chatId,
      projectPath,
      bridge,
      lastActivity: Date.now(),
      idleTimer: null,
    };

    this.resetIdleTimer(session);
    this.sessions.set(key, session);

    this.logger('info', `Dev session created: ${key}`);
    return bridge;
  }

  /** Update last activity and reset idle timer */
  private touchSession(session: DevSession): void {
    session.lastActivity = Date.now();
    this.resetIdleTimer(session);
  }

  /** Reset the idle timeout timer */
  private resetIdleTimer(session: DevSession): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      this.logger('info', `Idle timeout reached for session: ${session.key}`);
      this.destroySession(session).then(() => {
        this.sessions.delete(session.key);
      });
    }, IDLE_TIMEOUT_MS);
  }

  /** Evict the oldest (least recently used) session */
  private evictOldest(): void {
    let oldest: DevSession | null = null;
    for (const session of this.sessions.values()) {
      if (!oldest || session.lastActivity < oldest.lastActivity) {
        oldest = session;
      }
    }
    if (oldest) {
      this.logger('info', `Evicting oldest session: ${oldest.key}`);
      this.destroySession(oldest);
      this.sessions.delete(oldest.key);
    }
  }

  /** Destroy a session and cleanup */
  private async destroySession(session: DevSession): Promise<void> {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    try {
      await session.bridge.stop();
    } catch (err) {
      this.logger('warn', `Error stopping session ${session.key}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
