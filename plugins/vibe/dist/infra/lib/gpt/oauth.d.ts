/**
 * GPT 토큰 유틸리티 (codex-cli용)
 *
 * - JWT 디코딩 (이메일, 계정 ID, 플랜 추출)
 * - 토큰 갱신 (codex-cli credential refresh)
 */
interface RefreshedTokens {
    accessToken: string;
    refreshToken: string;
    expires: number;
}
interface JWTPayload {
    email?: string;
    sub?: string;
    [key: string]: unknown;
}
export type ChatGptPlan = 'pro' | 'plus' | 'free';
/**
 * JWT 디코딩 (서명 검증 없이)
 */
export declare function decodeJWT(token: string): JWTPayload | null;
/**
 * JWT에서 이메일 추출
 */
export declare function extractEmailFromToken(token: string): string | null;
/**
 * JWT에서 ChatGPT 계정 ID 추출
 */
export declare function extractAccountId(token: string): string | null;
/**
 * JWT에서 ChatGPT 플랜 추출
 */
export declare function extractPlanFromToken(token: string): ChatGptPlan;
/**
 * 액세스 토큰 갱신 (codex-cli credential refresh용)
 */
export declare function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens>;
export {};
//# sourceMappingURL=oauth.d.ts.map