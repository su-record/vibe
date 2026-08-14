/**
 * GPT 토큰 유틸리티 (codex-cli용)
 *
 * - JWT 디코딩 (이메일, 계정 ID, 플랜 추출)
 * - 토큰 갱신 (codex-cli credential refresh)
 */
import { GPT_CLIENT_ID, GPT_TOKEN_URL, JWT_CLAIM_PATH, } from './constants.js';
/**
 * JWT 디코딩 (서명 검증 없이)
 */
export function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = parts[1];
        const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
        return JSON.parse(decoded);
    }
    catch {
        return null;
    }
}
/**
 * JWT에서 이메일 추출
 */
export function extractEmailFromToken(token) {
    const payload = decodeJWT(token);
    if (!payload)
        return null;
    return payload.email || payload.sub || null;
}
/**
 * JWT에서 ChatGPT 계정 ID 추출
 */
export function extractAccountId(token) {
    const payload = decodeJWT(token);
    if (!payload)
        return null;
    const authClaim = payload[JWT_CLAIM_PATH];
    if (authClaim?.chatgpt_account_id) {
        return authClaim.chatgpt_account_id;
    }
    if (authClaim?.organization_id) {
        return authClaim.organization_id;
    }
    if (authClaim?.organizations && authClaim.organizations.length > 0) {
        return authClaim.organizations[0].organization_id;
    }
    return null;
}
/**
 * JWT에서 ChatGPT 플랜 추출
 */
export function extractPlanFromToken(token) {
    const payload = decodeJWT(token);
    if (!payload)
        return 'free';
    const authClaim = payload[JWT_CLAIM_PATH];
    if (!authClaim)
        return 'free';
    const paidId = authClaim.chatgpt_paid_id || '';
    if (/pro/i.test(paidId))
        return 'pro';
    if (/plus|paid/i.test(paidId))
        return 'plus';
    const tier = authClaim.user_tier || '';
    if (/pro/i.test(tier))
        return 'pro';
    if (/plus|paid/i.test(tier))
        return 'plus';
    if (paidId)
        return 'plus';
    return 'free';
}
/**
 * 액세스 토큰 갱신 (codex-cli credential refresh용)
 */
export async function refreshAccessToken(refreshToken) {
    const startTime = Date.now();
    const response = await fetch(GPT_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: GPT_CLIENT_ID,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
    }
    const payload = await response.json();
    return {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || refreshToken,
        expires: startTime + ((payload.expires_in || 3600) * 1000) - 60000,
    };
}
//# sourceMappingURL=oauth.js.map