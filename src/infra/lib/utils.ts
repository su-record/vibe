/**
 * 공통 유틸리티 함수
 */

/**
 * 지정된 시간만큼 대기
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Agent SDK query 함수 동적 로드
 * SDK가 설치되지 않은 경우 null 반환
 */
let agentSdkQuery: typeof import('@anthropic-ai/claude-agent-sdk').query | null = null;

export async function getAgentSdkQuery() {
  if (agentSdkQuery) return agentSdkQuery;

  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    agentSdkQuery = sdk.query;
    return agentSdkQuery;
  } catch { /* ignore: optional operation */
    return null;
  }
}

/**
 * 디버그 로깅 (환경변수로 제어)
 */
export function debugLog(message: string, ...args: unknown[]): void {
  if (process.env.VIBE_DEBUG === 'true') {
    console.log(`[VIBE DEBUG] ${message}`, ...args);
  }
}

/**
 * 경고 로깅 (환경변수로 제어)
 */
export function warnLog(message: string, ...args: unknown[]): void {
  if (process.env.VIBE_DEBUG === 'true') {
    console.warn(`[VIBE WARN] ${message}`, ...args);
  }
}

/**
 * 에러 로깅 (항상 출력, 단 verbose 모드에서만 상세)
 */
export function errorLog(message: string, error?: unknown): void {
  if (process.env.VIBE_DEBUG === 'true' && error) {
    console.error(`[VIBE ERROR] ${message}`, error);
  }
}

// ─── Error Categorization ───────────────────────────────────

/**
 * Error severity levels for consistent error handling across the codebase.
 * - fatal: must stop execution, user needs to know
 * - recoverable: can continue, but warn user
 * - ignorable: truly safe to ignore (e.g., legacy cleanup, optional features)
 */
export type ErrorSeverity = 'fatal' | 'recoverable' | 'ignorable';

/**
 * Extract a human-readable message from an unknown caught value.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Handle a caught error according to its severity.
 *
 * - fatal: logs to stderr and re-throws
 * - recoverable: logs a user-visible warning (via warnFn) and continues
 * - ignorable: logs only in debug mode
 *
 * @param severity - how critical the error is
 * @param context - short description of what was being attempted
 * @param error - the caught value
 * @param warnFn - optional callback for user-visible warnings (defaults to stderr)
 */
export function handleCaughtError(
  severity: ErrorSeverity,
  context: string,
  error: unknown,
  warnFn?: (msg: string) => void,
): void {
  const message = extractErrorMessage(error);

  switch (severity) {
    case 'fatal':
      process.stderr.write(`[VIBE FATAL] ${context}: ${message}\n`);
      throw error;

    case 'recoverable': {
      const warning = `   ⚠️  ${context}: ${message}`;
      if (warnFn) {
        warnFn(warning);
      } else {
        process.stderr.write(warning + '\n');
      }
      break;
    }

    case 'ignorable':
      debugLog(`[ignorable] ${context}: ${message}`);
      break;
  }
}

/**
 * 안전한 JSON 파싱
 * @param jsonString 파싱할 JSON 문자열
 * @param context 에러 로깅에 사용할 컨텍스트 설명
 * @returns 파싱된 객체 또는 null
 */
export function safeParseJSON<T = unknown>(jsonString: string, context?: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    const ctx = context ? ` (${context})` : '';
    warnLog(`JSON parse failed${ctx}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * 안전한 JSON 파싱 (기본값 반환)
 * @param jsonString 파싱할 JSON 문자열
 * @param defaultValue 파싱 실패 시 반환할 기본값
 * @param context 에러 로깅에 사용할 컨텍스트 설명
 * @returns 파싱된 객체 또는 기본값
 */
export function safeParseJSONWithDefault<T>(jsonString: string, defaultValue: T, context?: string): T {
  const result = safeParseJSON<T>(jsonString, context);
  return result ?? defaultValue;
}
