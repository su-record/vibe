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
