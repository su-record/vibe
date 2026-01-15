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
