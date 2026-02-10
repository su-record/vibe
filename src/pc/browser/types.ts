/**
 * Browser Automation Types
 *
 * Playwright ARIA Snapshot 기반 브라우저 자동화 타입 정의.
 * OpenClaw 패턴 참조, VIBE MCP 도구 체계에 맞춰 재구현.
 */

import type { Page, BrowserContext, CDPSession } from 'playwright';

// ============================================================================
// Provider Interface (Factory Pattern)
// ============================================================================

/** 브라우저 프로바이더 인터페이스 — Local(Phase1) / Sandbox(Phase5) 분기 */
export interface IBrowserProvider {
  /** CDP WebSocket URL 반환 */
  getCDPUrl(): Promise<string>;
  /** 샌드박스 모드 여부 */
  isSandboxed(): boolean;
  /** 프로바이더 종료 */
  terminate(): Promise<void>;
  /** 프로바이더 이름 */
  readonly name: string;
}

// ============================================================================
// Role Ref System
// ============================================================================

/** 개별 역할 참조 (e1, e2, ...) */
export interface RoleRef {
  role: string;
  name?: string;
  nth?: number;
}

/** ref ID → RoleRef 매핑 */
export type RoleRefMap = Record<string, RoleRef>;

/** 인터랙티브 역할 (클릭/입력 가능 요소) */
export const INTERACTIVE_ROLES: ReadonlySet<string> = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
  'listbox', 'menuitem', 'option', 'searchbox', 'slider',
  'switch', 'tab', 'treeitem',
]);

/** 콘텐츠 역할 (이름 있으면 ref 할당) */
export const CONTENT_ROLES: ReadonlySet<string> = new Set([
  'heading', 'cell', 'gridcell', 'columnheader', 'listitem',
  'article', 'region', 'main', 'navigation',
]);

/** 구조 역할 (compact 모드에서 제거) */
export const STRUCTURAL_ROLES: ReadonlySet<string> = new Set([
  'generic', 'group', 'list', 'table', 'row', 'menu', 'toolbar',
  'tablist', 'tree', 'banner', 'complementary', 'contentinfo',
  'dialog', 'form', 'grid', 'separator', 'status',
]);

// ============================================================================
// Snapshot Options
// ============================================================================

export interface SnapshotOptions {
  /** 인터랙티브 요소만 필터링 */
  interactive?: boolean;
  /** 구조 요소 제거 (compact 모드) */
  compact?: boolean;
  /** 최대 트리 깊이 */
  maxDepth?: number;
}

export interface SnapshotResult {
  /** ARIA 트리 텍스트 (AI-friendly) */
  tree: string;
  /** ref ID → RoleRef 매핑 */
  refs: RoleRefMap;
  /** 스냅샷 버전 (stale ref 감지용) */
  snapshotVersion: number;
  /** 콘텐츠 체크섬 (변경 감지) */
  checksum: string;
  /** 인터랙티브 요소 수 */
  interactiveCount: number;
  /** 전체 요소 수 */
  totalCount: number;
}

// ============================================================================
// Browser Session
// ============================================================================

export interface BrowserSessionInfo {
  tenantId: string;
  targetId: string;
  url: string;
  title: string;
  connected: boolean;
  createdAt: string;
}

export interface PageState {
  roleRefs: RoleRefMap;
  snapshotVersion: number;
  lastSnapshotAt?: string;
}

// ============================================================================
// Action Types
// ============================================================================

export type BrowserActionType =
  | 'click' | 'type' | 'scroll' | 'pressKey'
  | 'navigate' | 'screenshot' | 'fillForm';

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
}

export interface TypeOptions {
  submit?: boolean;
  slowly?: boolean;
}

export interface FormField {
  ref: string;
  value: string;
  type?: 'text' | 'checkbox' | 'radio' | 'select';
}

export interface ScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  ref?: string;
  quality?: number;
}

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

// ============================================================================
// Action Result
// ============================================================================

export interface BrowserActionResult {
  success: boolean;
  action: string;
  data?: unknown;
  error?: BrowserError;
  durationMs: number;
}

// ============================================================================
// Error Types
// ============================================================================

export type BrowserErrorCode =
  | 'CDP_CONNECTION_FAILED'
  | 'ACTION_TIMEOUT'
  | 'REF_STALE'
  | 'REF_NOT_FOUND'
  | 'NAVIGATION_BLOCKED'
  | 'SCREENSHOT_FAILED'
  | 'BROWSER_DISCONNECTED'
  | 'SNAPSHOT_FAILED'
  | 'UNSUPPORTED_API'
  | 'MAX_SESSIONS_REACHED'
  | 'UNKNOWN_ERROR';

export interface BrowserError {
  error: BrowserErrorCode;
  message: string;
  retries?: number;
  timeout?: number;
  details?: unknown;
}

// ============================================================================
// Connection Config
// ============================================================================

export interface BrowserServiceConfig {
  /** CDP 연결 타임아웃 (ms) */
  connectTimeout?: number;
  /** 액션 기본 타임아웃 (ms) */
  actionTimeout?: number;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 로컬 최대 동시 세션 */
  maxLocalSessions?: number;
  /** SaaS 사용자당 최대 세션 */
  maxSaasSessionsPerUser?: number;
  /** 스크린샷 저장 디렉토리 */
  screenshotDir?: string;
}

export const DEFAULT_CONFIG: BrowserServiceConfig = {
  connectTimeout: 10_000,
  actionTimeout: 8_000,
  maxRetries: 3,
  maxLocalSessions: 3,
  maxSaasSessionsPerUser: 1,
};

// ============================================================================
// URL Validation
// ============================================================================

/** 허용 URL 스킴 */
export const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

/** 차단 호스트네임 (SSRF 방지) */
export const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '[::]',
  '[::1]',
]);

/** 차단 IP 대역 (SSRF 방지) */
export const BLOCKED_IP_PATTERNS: readonly RegExp[] = [
  /^127\./,              // loopback
  /^10\./,               // private A
  /^172\.(1[6-9]|2\d|3[01])\./,  // private B
  /^192\.168\./,         // private C
  /^169\.254\./,         // link-local / metadata
  /^0\./,                // unspecified
  /^::1$/,               // IPv6 loopback
  /^fc00:/i,             // IPv6 unique local
  /^fe80:/i,             // IPv6 link-local
  /^::ffff:127\./i,     // IPv4-mapped IPv6 loopback
  /^::ffff:10\./i,      // IPv4-mapped IPv6 private A
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv4-mapped IPv6 private B
  /^::ffff:192\.168\./i, // IPv4-mapped IPv6 private C
  /^::ffff:169\.254\./i, // IPv4-mapped IPv6 link-local
];

// ============================================================================
// Internal Types (for WeakMap state)
// ============================================================================

export interface ConnectedBrowser {
  context: BrowserContext;
  cdpSession: CDPSession;
  cdpUrl: string;
  provider: IBrowserProvider;
  connectedAt: string;
}

export interface RoleRefsCacheEntry {
  refs: RoleRefMap;
  snapshotVersion: number;
  cachedAt: number;
}
