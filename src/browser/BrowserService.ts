/**
 * BrowserService — Playwright CDP 연결 관리 (팩토리 패턴)
 *
 * IBrowserProvider를 통해 Local(Phase1) / Sandbox(Phase5) 분기.
 * 연결 캐싱, 자동 재연결 (exponential backoff + jitter), 테넌트별 격리.
 */

import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import * as crypto from 'node:crypto';
import type {
  IBrowserProvider,
  ConnectedBrowser,
  BrowserServiceConfig,
  BrowserSessionInfo,
  BrowserError,
  PageState,
  RoleRefMap,
  RoleRefsCacheEntry,
} from './types.js';
import { DEFAULT_CONFIG, ALLOWED_SCHEMES, BLOCKED_HOSTNAMES, BLOCKED_IP_PATTERNS } from './types.js';

type Logger = (level: string, message: string, data?: unknown) => void;

/** LRU 캐시 — targetId 기반 ref 캐싱 (최대 50개) */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class BrowserService {
  private browser: Browser | null = null;
  private contexts = new Map<string, BrowserContext>();
  private pageStates = new WeakMap<Page, PageState>();
  private refCache = new LRUCache<string, RoleRefsCacheEntry>(50);
  private config: Required<BrowserServiceConfig>;
  private logger: Logger;
  private connecting: Promise<Browser> | null = null;

  constructor(logger: Logger, config?: BrowserServiceConfig) {
    this.logger = logger;
    this.config = {
      connectTimeout: config?.connectTimeout ?? DEFAULT_CONFIG.connectTimeout!,
      actionTimeout: config?.actionTimeout ?? DEFAULT_CONFIG.actionTimeout!,
      maxRetries: config?.maxRetries ?? DEFAULT_CONFIG.maxRetries!,
      maxLocalSessions: config?.maxLocalSessions ?? DEFAULT_CONFIG.maxLocalSessions!,
      maxSaasSessionsPerUser: config?.maxSaasSessionsPerUser ?? DEFAULT_CONFIG.maxSaasSessionsPerUser!,
      screenshotDir: config?.screenshotDir ?? '',
    };
  }

  /** CDP provider를 통해 브라우저에 연결 */
  async connect(provider: IBrowserProvider): Promise<void> {
    if (this.browser?.isConnected()) return;
    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = this.connectWithRetry(provider);
    try {
      this.browser = await this.connecting;
      this.logger('info', `Browser connected via ${provider.name}`);
    } finally {
      this.connecting = null;
    }
  }

  /** 연결 해제 및 정리 */
  async disconnect(): Promise<void> {
    for (const [tenantId, ctx] of this.contexts) {
      try {
        await ctx.close();
      } catch (err) {
        this.logger('warn', `Failed to close context for tenant "${tenantId}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      this.contexts.delete(tenantId);
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        this.logger('warn', 'Failed to close browser', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      this.browser = null;
    }
    this.refCache.clear();
    this.logger('info', 'Browser disconnected');
  }

  /** 연결 상태 확인 */
  isConnected(): boolean {
    return this.browser?.isConnected() ?? false;
  }

  /** 테넌트별 격리된 Page 객체 반환 */
  async getPage(tenantId: string, targetId?: string): Promise<Page> {
    this.ensureConnected();

    let context = this.contexts.get(tenantId);
    if (!context) {
      this.enforceSessionLimit(tenantId);
      context = await this.browser!.newContext();
      this.contexts.set(tenantId, context);
    }

    if (targetId) {
      const existing = context.pages().find(p => this.getTargetId(p) === targetId);
      if (existing) return existing;
    }

    const pages = context.pages();
    if (pages.length > 0 && !targetId) return pages[0];

    const page = await context.newPage();
    this.setupDialogHandler(page);
    return page;
  }

  /** 활성 페이지 목록 조회 */
  async listPages(tenantId: string): Promise<BrowserSessionInfo[]> {
    const context = this.contexts.get(tenantId);
    if (!context) return [];

    return context.pages().map(page => ({
      tenantId,
      targetId: this.getTargetId(page),
      url: page.url(),
      title: '', // sync access only
      connected: this.isConnected(),
      createdAt: new Date().toISOString(),
    }));
  }

  /** 새 탭 열기 (URL 검증 포함) */
  async openPage(tenantId: string, url: string): Promise<Page> {
    this.validateNavigationUrl(url);
    const page = await this.getPage(tenantId);
    await page.goto(url, { timeout: this.config.connectTimeout });
    return page;
  }

  /** 특정 탭 닫기 */
  async closePage(tenantId: string, targetId: string): Promise<void> {
    const context = this.contexts.get(tenantId);
    if (!context) return;
    const page = context.pages().find(p => this.getTargetId(p) === targetId);
    if (page) await page.close();
  }

  /** 테넌트 컨텍스트 전체 삭제 (ephemeral) */
  async destroyContext(tenantId: string): Promise<void> {
    const context = this.contexts.get(tenantId);
    if (context) {
      await context.close();
      this.contexts.delete(tenantId);
    }
  }

  /** 페이지 상태 저장/조회 */
  getPageState(page: Page): PageState | undefined {
    return this.pageStates.get(page);
  }

  setPageState(page: Page, state: PageState): void {
    this.pageStates.set(page, state);
  }

  /** ref 캐시 관리 */
  cacheRefs(targetId: string, refs: RoleRefMap, version: number): void {
    this.refCache.set(targetId, {
      refs,
      snapshotVersion: version,
      cachedAt: Date.now(),
    });
  }

  getCachedRefs(targetId: string): RoleRefsCacheEntry | undefined {
    return this.refCache.get(targetId);
  }

  /** 활성 세션 수 */
  get activeSessionCount(): number {
    return this.contexts.size;
  }

  get actionTimeout(): number {
    return this.config.actionTimeout;
  }

  // ──────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────

  /** URL 보안 검증 (SSRF 방지) */
  private validateNavigationUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw this.createError('NAVIGATION_BLOCKED', `Invalid URL: ${url}`);
    }
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw this.createError('NAVIGATION_BLOCKED',
        `Blocked scheme "${parsed.protocol}". Only http/https allowed.`);
    }
    if (BLOCKED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      throw this.createError('NAVIGATION_BLOCKED',
        `Blocked hostname: ${parsed.hostname}`);
    }
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(parsed.hostname)) {
        throw this.createError('NAVIGATION_BLOCKED',
          `Blocked private/metadata IP: ${parsed.hostname}`);
      }
    }
  }

  /** exponential backoff + jitter 재시도 */
  private async connectWithRetry(provider: IBrowserProvider): Promise<Browser> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const cdpUrl = await provider.getCDPUrl();
        const browser = await chromium.connectOverCDP(cdpUrl, {
          timeout: this.config.connectTimeout,
        });
        return browser;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000 - 500;     // ±500ms
        const delay = Math.max(0, baseDelay + jitter);
        this.logger('warn', `CDP connection attempt ${attempt + 1}/${this.config.maxRetries} failed, retrying in ${Math.round(delay)}ms`, {
          error: lastError.message,
        });
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('CDP connection failed');
  }

  private ensureConnected(): void {
    if (!this.browser?.isConnected()) {
      throw this.createError('BROWSER_DISCONNECTED', 'Browser is not connected');
    }
  }

  private enforceSessionLimit(tenantId: string): void {
    if (this.contexts.size >= this.config.maxLocalSessions) {
      throw this.createError('MAX_SESSIONS_REACHED',
        `Maximum ${this.config.maxLocalSessions} concurrent sessions reached`);
    }
  }

  private getTargetId(page: Page): string {
    // URL-based identifier (CDP target ID not directly available)
    return crypto.createHash('md5').update(page.url()).digest('hex').slice(0, 8);
  }

  private setupDialogHandler(page: Page): void {
    page.on('dialog', async (dialog) => {
      try {
        this.logger('info', `Auto-dismissing ${dialog.type()} dialog: ${dialog.message()}`);
        await dialog.dismiss();
      } catch (err) {
        this.logger('warn', 'Failed to dismiss dialog', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** 구조화된 에러 생성 */
  createError(code: BrowserError['error'], message: string, extra?: Partial<BrowserError>): BrowserError & Error {
    const error = new Error(message) as BrowserError & Error;
    error.error = code;
    error.message = message;
    if (extra?.retries !== undefined) error.retries = extra.retries;
    if (extra?.timeout !== undefined) error.timeout = extra.timeout;
    if (extra?.details !== undefined) error.details = extra.details;
    return error;
  }
}

// ============================================================================
// LocalBrowserProvider — Phase 1 (로컬 Chrome CDP 연결)
// ============================================================================

export class LocalBrowserProvider implements IBrowserProvider {
  readonly name = 'local';
  private cdpPort: number;
  private process: import('node:child_process').ChildProcess | null = null;

  constructor(cdpPort = 9222) {
    this.cdpPort = cdpPort;
  }

  async getCDPUrl(): Promise<string> {
    // 기존 Chrome CDP 엔드포인트 탐색
    try {
      const resp = await fetch(`http://127.0.0.1:${this.cdpPort}/json/version`);
      const data = await resp.json() as { webSocketDebuggerUrl?: string };
      if (data.webSocketDebuggerUrl) {
        return data.webSocketDebuggerUrl;
      }
    } catch {
      // CDP 미실행 — Playwright 내장 브라우저로 대체
    }

    // Playwright chromium launch (CDP 서버 포함)
    return `http://127.0.0.1:${this.cdpPort}`;
  }

  isSandboxed(): boolean {
    return false;
  }

  async terminate(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
