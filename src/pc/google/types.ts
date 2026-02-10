/**
 * Google Per-User OAuth Types
 *
 * Phase 2: per-user 토큰 관리, envelope encryption, incremental scope.
 * 기존 src/router/services/google-types.ts 는 API response 타입.
 * 이 파일은 토큰 관리 + OAuth flow 전용.
 */

// ============================================================================
// Google Scope Definitions
// ============================================================================

/** 지원하는 Google API scope 매핑 */
export const GOOGLE_SCOPE_MAP: Readonly<Record<string, string>> = {
  'gmail.readonly': 'https://www.googleapis.com/auth/gmail.readonly',
  'gmail.send': 'https://www.googleapis.com/auth/gmail.send',
  'drive': 'https://www.googleapis.com/auth/drive',
  'drive.file': 'https://www.googleapis.com/auth/drive.file',
  'spreadsheets': 'https://www.googleapis.com/auth/spreadsheets',
  'calendar': 'https://www.googleapis.com/auth/calendar',
  'calendar.events': 'https://www.googleapis.com/auth/calendar.events',
  'youtube.readonly': 'https://www.googleapis.com/auth/youtube.readonly',
  'userinfo.email': 'https://www.googleapis.com/auth/userinfo.email',
} as const;

export type ScopeAlias = keyof typeof GOOGLE_SCOPE_MAP;

// ============================================================================
// Token Types
// ============================================================================

/** 암호화된 토큰 (DB 저장용) */
export interface EncryptedTokenRow {
  userId: string;
  provider: string;
  scopeHash: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: number;
  createdAt: string;
  familyId: string;
  generation: number;
  dekWrapped: string;
  kekVersion: number;
}

/** 복호화된 토큰 (메모리 전용) */
export interface DecryptedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  familyId: string;
  generation: number;
}

/** Token family (refresh token rotation tracking) */
export interface TokenFamily {
  familyId: string;
  userId: string;
  createdAt: string;
  compromised: boolean;
  lastUsedAt: string;
}

// ============================================================================
// OAuth Flow Types
// ============================================================================

export interface PKCEPair {
  verifier: string;
  challenge: string;
}

export interface OAuthState {
  userId: string;
  scopes: string[];
  verifier: string;
  createdAt: number;
}

/** OAuth 콜백 핸들러 인터페이스 (Local/SaaS 분기) */
export interface ICallbackHandler {
  /** 인증 코드 수신 대기 (Promise resolves with code) */
  waitForCallback(state: string): Promise<string>;
  /** 핸들러 종료 */
  close(): void;
  /** 리다이렉트 URI */
  readonly redirectUri: string;
}

export interface OAuthFlowConfig {
  clientId: string;
  clientSecret?: string;
  callbackPort?: number;
  authTimeoutMs?: number;
}

// ============================================================================
// Encryption Types
// ============================================================================

/** 데이터 암호화 키 (DEK) */
export interface DEK {
  key: Buffer;
  iv: Buffer;
}

/** 봉투 암호화 결과 */
export interface EnvelopeEncrypted {
  ciphertext: string;
  dekWrapped: string;
  kekVersion: number;
}

// ============================================================================
// Error Types
// ============================================================================

export type GoogleErrorCode =
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESH_FAILED'
  | 'SCOPE_DENIED'
  | 'FAMILY_COMPROMISED'
  | 'API_ERROR'
  | 'API_TIMEOUT'
  | 'RATE_LIMITED'
  | 'ENCRYPTION_FAILED'
  | 'UNKNOWN_ERROR';

export interface GoogleError {
  code: GoogleErrorCode;
  message: string;
  retries?: number;
  details?: unknown;
}

/** 구조화된 Google 에러 (Error 확장) */
export function createGoogleError(
  code: GoogleErrorCode,
  message: string,
  extra?: Partial<GoogleError>,
): GoogleError & Error {
  const error = new Error(message) as GoogleError & Error;
  error.code = code;
  error.message = message;
  if (extra?.retries !== undefined) error.retries = extra.retries;
  if (extra?.details !== undefined) error.details = extra.details;
  return error;
}

// ============================================================================
// Service Config
// ============================================================================

export interface GoogleServiceConfig {
  /** API 호출 타임아웃 (ms) */
  apiTimeout?: number;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 토큰 갱신 마진 (ms, 만료 전 갱신 시점) */
  refreshMarginMs?: number;
}

export const DEFAULT_GOOGLE_CONFIG: Required<GoogleServiceConfig> = {
  apiTimeout: 10_000,
  maxRetries: 3,
  refreshMarginMs: 60_000,
};

// ============================================================================
// Logger Type
// ============================================================================

export type GoogleLogger = (level: string, message: string, data?: unknown) => void;
