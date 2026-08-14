/**
 * GPT 인증 관리
 * - 고정 순서: codex-cli → apikey
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { refreshAccessToken, extractEmailFromToken, extractAccountId, extractPlanFromToken } from './oauth.js';
import { tokenRefresher } from '../llm/auth/index.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import { getGptApiKey } from '../config/GlobalConfigManager.js';
// 고정 인증 순서: codex-cli → apikey
const AUTH_ORDER = ['codex-cli', 'apikey'];
function isCodexAuthFile(data) {
    if (typeof data !== 'object' || data === null)
        return false;
    const obj = data;
    if (typeof obj.tokens !== 'object' || obj.tokens === null)
        return false;
    const tokens = obj.tokens;
    return (typeof tokens.access_token === 'string' &&
        typeof tokens.refresh_token === 'string');
}
/** Codex CLI credential 경로 (CODEX_HOME 우선 → ~/.codex 기본) */
function getCodexCredentialPaths() {
    const paths = [];
    const codexHome = process.env.CODEX_HOME;
    if (codexHome) {
        paths.push(path.join(codexHome, 'auth.json'));
    }
    paths.push(path.join(os.homedir(), '.codex', 'auth.json'));
    return paths;
}
/**
 * Codex CLI credential 파일 탐색 (read-only, 보안 체크)
 */
export function findCodexCredentials() {
    for (const credPath of getCodexCredentialPaths()) {
        try {
            const stat = fs.lstatSync(credPath);
            if (stat.isSymbolicLink() || !stat.isFile())
                continue;
            // 소유자 확인 (macOS/Linux)
            if (process.platform !== 'win32') {
                const uid = process.getuid?.();
                if (uid !== undefined && stat.uid !== uid)
                    continue;
                const mode = stat.mode & 0o777;
                if ((mode & 0o077) !== 0)
                    continue;
            }
            const content = fs.readFileSync(credPath, 'utf-8');
            const data = JSON.parse(content);
            if (!isCodexAuthFile(data))
                continue;
            return data;
        }
        catch {
            continue;
        }
    }
    return null;
}
/** JWT payload에서 exp claim 추출 (초 단위 → ms) */
function getJwtExpiry(token) {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.exp * 1000;
    }
    catch {
        return NaN;
    }
}
/** Codex CLI credential로 인증 시도 */
async function tryCodexCliAuth() {
    const creds = findCodexCredentials();
    if (!creds)
        return null;
    try {
        // expires_at 필드가 없으면 JWT exp claim으로 폴백
        let expiresAt = new Date(creds.tokens.expires_at).getTime();
        if (isNaN(expiresAt)) {
            expiresAt = getJwtExpiry(creds.tokens.access_token);
        }
        let accessToken = creds.tokens.access_token;
        if (isNaN(expiresAt) || expiresAt <= Date.now() + 5 * 60 * 1000) {
            if (!creds.tokens.refresh_token)
                return null;
            // 병렬 에이전트가 같은 Codex 토큰을 동시에 refresh 하는 storm 을 막는다 (B-5):
            // refreshWithLock 의 in-process dedupe(같은 프로세스 내 동시 호출은 단일 promise 공유)
            // + cross-process file lock. readCurrentToken 으로 다른 주체가 이미 갱신한 토큰을 재사용.
            const refreshed = await tokenRefresher.refreshWithLock('gpt', () => refreshAccessToken(creds.tokens.refresh_token), () => {
                const c = findCodexCredentials();
                if (!c?.tokens?.access_token)
                    return null;
                let exp = new Date(c.tokens.expires_at).getTime();
                if (isNaN(exp))
                    exp = getJwtExpiry(c.tokens.access_token);
                return { accessToken: c.tokens.access_token, expires: isNaN(exp) ? 0 : exp };
            });
            accessToken = refreshed.accessToken;
        }
        const email = extractEmailFromToken(accessToken);
        const accountId = extractAccountId(accessToken);
        const plan = extractPlanFromToken(accessToken);
        return {
            type: 'codex-cli',
            accessToken,
            email: email || 'unknown',
            accountId: accountId || undefined,
            plan,
        };
    }
    catch {
        return null;
    }
}
// API Key 가져오기 (config.json 우선 → 환경변수 fallback)
export function getApiKeyFromConfig() {
    const configKey = getGptApiKey();
    if (configKey)
        return configKey;
    if (process.env.OPENAI_API_KEY)
        return process.env.OPENAI_API_KEY;
    return null;
}
/**
 * 개별 인증 방식 시도
 */
async function tryAuthMethod(method) {
    switch (method) {
        case 'codex-cli':
            return tryCodexCliAuth();
        case 'apikey': {
            const apiKey = getApiKeyFromConfig();
            if (apiKey) {
                return { type: 'apikey', apiKey };
            }
            return null;
        }
        default:
            return null;
    }
}
/**
 * 인증 방식 확인 (고정 순서: codex-cli → apikey)
 */
export async function getAuthInfo() {
    for (const method of AUTH_ORDER) {
        const auth = await tryAuthMethod(method);
        if (auth)
            return auth;
    }
    throw new Error('GPT credentials not found. Tried: codex-cli, apikey. ' +
        'Run: codex auth (Codex CLI) or vibe gpt key <key> (API Key) to configure.');
}
/**
 * Auth Profile 기반 성공/실패 마킹 (optional)
 */
export async function markAuthSuccess(profileId) {
    try {
        const manager = getAuthProfileManager();
        await manager.markSuccess(profileId);
    }
    catch {
        // Profile rotation is optional
    }
}
export async function markAuthFailure(profileId, errorMsg) {
    try {
        const manager = getAuthProfileManager();
        await manager.markFailure(profileId, errorMsg);
    }
    catch {
        // Profile rotation is optional
    }
}
//# sourceMappingURL=auth.js.map