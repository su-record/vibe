/**
 * GPT 인증 관리
 * - 고정 순서: codex-cli → apikey
 */
import type { AuthInfo } from './types.js';
/** Codex CLI auth.json 구조 */
interface CodexAuthFile {
    auth_mode: string;
    tokens: {
        access_token: string;
        refresh_token: string;
        id_token?: string;
        expires_at: string;
    };
}
/**
 * Codex CLI credential 파일 탐색 (read-only, 보안 체크)
 */
export declare function findCodexCredentials(): CodexAuthFile | null;
export declare function getApiKeyFromConfig(): string | null;
/**
 * 인증 방식 확인 (고정 순서: codex-cli → apikey)
 */
export declare function getAuthInfo(): Promise<AuthInfo>;
/**
 * Auth Profile 기반 성공/실패 마킹 (optional)
 */
export declare function markAuthSuccess(profileId: string): Promise<void>;
export declare function markAuthFailure(profileId: string, errorMsg?: string): Promise<void>;
export {};
//# sourceMappingURL=auth.d.ts.map