/**
 * Antigravity API 인증 관리
 *
 * Auth: API Key 전용 (Antigravity CLI / Codex CLI 는 hooks에서 직접 호출)
 *
 * 환경변수:
 *   - ANTIGRAVITY_API_KEY → API Key
 */
import type { AuthInfo } from './types.js';
/**
 * API Key 가져오기 (config.json 우선 → 환경변수 fallback)
 */
export declare function getApiKeyFromConfig(): string | null;
/**
 * 인증 정보 반환 (API Key 전용)
 */
export declare function getAuthInfo(): Promise<AuthInfo>;
//# sourceMappingURL=auth.d.ts.map