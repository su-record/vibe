/**
 * BrowserPool - Pooled browser context management
 * Max 3 concurrent contexts, idle timeout, crash recovery
 */

import { InterfaceLogger } from '../../interface/types.js';
import { BrowserManager } from './BrowserManager.js';

const MAX_POOL_SIZE = 3;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Minimal browser context interface */
interface PooledContext {
  newPage(): Promise<unknown>;
  close(): Promise<void>;
  pages(): unknown[];
}

interface PoolEntry {
  context: PooledContext;
  inUse: boolean;
  lastUsed: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export class BrowserPool {
  private logger: InterfaceLogger;
  private manager: BrowserManager;
  private pool: PoolEntry[] = [];

  constructor(logger: InterfaceLogger, manager: BrowserManager) {
    this.logger = logger;
    this.manager = manager;
  }

  /** Acquire a browser context from the pool */
  async acquire(): Promise<PooledContext> {
    // Reuse idle context
    const idle = this.pool.find((e) => !e.inUse);
    if (idle) {
      idle.inUse = true;
      idle.lastUsed = Date.now();
      this.clearIdleTimer(idle);
      return idle.context;
    }

    // Evict oldest if at capacity
    if (this.pool.length >= MAX_POOL_SIZE) {
      await this.evictOldest();
    }

    // Create new context
    const context = await this.createContext();
    const entry: PoolEntry = {
      context,
      inUse: true,
      lastUsed: Date.now(),
      idleTimer: null,
    };
    this.pool.push(entry);
    this.logger('info', `브라우저 풀: 새 컨텍스트 생성 (${this.pool.length}/${MAX_POOL_SIZE})`);
    return context;
  }

  /** Release a context back to the pool */
  release(context: PooledContext): void {
    const entry = this.pool.find((e) => e.context === context);
    if (!entry) return;

    entry.inUse = false;
    entry.lastUsed = Date.now();
    this.startIdleTimer(entry);
  }

  /** Close all contexts and clear the pool */
  async closeAll(): Promise<void> {
    for (const entry of this.pool) {
      this.clearIdleTimer(entry);
      await this.safeClose(entry.context);
    }
    this.pool = [];
    this.logger('info', '브라우저 풀: 모든 컨텍스트 종료');
  }

  /** Get pool statistics */
  getStats(): { total: number; inUse: number; idle: number } {
    const inUse = this.pool.filter((e) => e.inUse).length;
    return { total: this.pool.length, inUse, idle: this.pool.length - inUse };
  }

  private async createContext(): Promise<PooledContext> {
    try {
      return await this.manager.getContext() as unknown as PooledContext;
    } catch (err) {
      this.logger('error', 'BrowserPool: 컨텍스트 생성 실패', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async evictOldest(): Promise<void> {
    const idleEntries = this.pool
      .filter((e) => !e.inUse)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    if (idleEntries.length === 0) {
      throw new Error('브라우저 풀 용량 초과: 모든 컨텍스트가 사용 중입니다.');
    }

    const oldest = idleEntries[0];
    this.clearIdleTimer(oldest);
    await this.safeClose(oldest.context);
    this.pool = this.pool.filter((e) => e !== oldest);
  }

  private startIdleTimer(entry: PoolEntry): void {
    this.clearIdleTimer(entry);
    entry.idleTimer = setTimeout(async () => {
      if (!entry.inUse) {
        await this.safeClose(entry.context);
        this.pool = this.pool.filter((e) => e !== entry);
        this.logger('info', `브라우저 풀: 유휴 컨텍스트 종료 (${this.pool.length}/${MAX_POOL_SIZE})`);
      }
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(entry: PoolEntry): void {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
  }

  private async safeClose(context: PooledContext): Promise<void> {
    try {
      await context.close();
    } catch (err) {
      this.logger('warn', 'BrowserPool: 컨텍스트 종료 실패', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
