/**
 * GPT 인증 관리
 * - 고정 순서: oauth → codex-cli → apikey
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { getValidAccessToken, refreshAccessToken, extractEmailFromToken, extractAccountId, extractPlanFromToken } from './oauth.js';
import { warnLog } from '../utils.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import { getGptApiKey } from '../config/GlobalConfigManager.js';
import type { AuthInfo, GptAuthMethod } from './types.js';

// 고정 인증 순서: oauth → codex-cli → apikey
const AUTH_ORDER: GptAuthMethod[] = ['oauth', 'codex-cli', 'apikey'];

// =============================================
// Codex CLI credential auto-detection
// =============================================

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

function isCodexAuthFile(data: unknown): data is CodexAuthFile {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.tokens !== 'object' || obj.tokens === null) return false;
  const tokens = obj.tokens as Record<string, unknown>;
  return (
    typeof tokens.access_token === 'string' &&
    typeof tokens.refresh_token === 'string'
  );
}

/** Codex CLI credential 경로 (CODEX_HOME 우선 → ~/.codex 기본) */
function getCodexCredentialPaths(): string[] {
  const paths: string[] = [];
  const codexHome = process.env.CODEX_HOME;
  if (codexHome) {
    paths.push(path.join(codexHome, 'auth.json'));
  }
  paths.push(path.join(os.homedir(), '.codex', 'auth.json'));
  return paths;
}

/**
 * Codex CLI credential 파일 탐색 (read-only, 보안 체크)
 * Gemini의 findOAuthCredentials() 패턴과 동일
 */
export function findCodexCredentials(): CodexAuthFile | null {
  for (const credPath of getCodexCredentialPaths()) {
    try {
      const stat = fs.lstatSync(credPath);
      if (stat.isSymbolicLink() || !stat.isFile()) continue;

      // 소유자 확인 (macOS/Linux)
      if (process.platform !== 'win32') {
        const uid = process.getuid?.();
        if (uid !== undefined && stat.uid !== uid) continue;
        const mode = stat.mode & 0o777;
        if ((mode & 0o077) !== 0) continue;
      }

      const content = fs.readFileSync(credPath, 'utf-8');
      const data: unknown = JSON.parse(content);
      if (!isCodexAuthFile(data)) continue;
      return data;
    } catch {
      continue;
    }
  }
  return null;
}

/** Codex CLI credential로 인증 시도 */
async function tryCodexCliAuth(): Promise<AuthInfo | null> {
  const creds = findCodexCredentials();
  if (!creds) return null;

  try {
    // 토큰 만료 확인 → 필요시 refresh
    const expiresAt = new Date(creds.tokens.expires_at).getTime();
    let accessToken = creds.tokens.access_token;

    if (isNaN(expiresAt) || expiresAt <= Date.now() + 5 * 60 * 1000) {
      if (!creds.tokens.refresh_token) return null;
      const refreshed = await refreshAccessToken(creds.tokens.refresh_token);
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
  } catch {
    return null;
  }
}

// API Key 가져오기 (config.json 우선 → 환경변수 fallback)
export function getApiKeyFromConfig(): string | null {
  const configKey = getGptApiKey();
  if (configKey) return configKey;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  return null;
}

// OAuth 토큰 없을 때 config에서 email 제거
export function removeEmailFromConfigIfNoToken(): void {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.gpt?.email) {
        delete config.models.gpt.email;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    }
  } catch (e) {
    warnLog('Failed to remove email from GPT config', e);
  }
}

/**
 * 개별 인증 방식 시도
 */
async function tryAuthMethod(method: GptAuthMethod): Promise<AuthInfo | null> {
  switch (method) {
    case 'oauth': {
      try {
        const { accessToken, email, accountId, plan } = await getValidAccessToken();
        return { type: 'oauth', accessToken, email, accountId, plan };
      } catch {
        removeEmailFromConfigIfNoToken();
        return null;
      }
    }
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
 * 인증 방식 확인 (고정 순서: oauth → codex-cli → apikey)
 * 순서대로 시도, 실패 시 다음 방식으로 fallback
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  for (const method of AUTH_ORDER) {
    const auth = await tryAuthMethod(method);
    if (auth) return auth;
  }

  throw new Error(
    'GPT credentials not found. Tried: oauth, codex-cli, apikey. ' +
    'Run: codex auth (Codex CLI) or vibe gpt key <key> (API Key) to configure.'
  );
}

/**
 * Auth Profile 기반 성공/실패 마킹 (optional)
 */
export async function markAuthSuccess(profileId: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markSuccess(profileId);
  } catch {
    // Profile rotation is optional — ignore errors
  }
}

export async function markAuthFailure(profileId: string, errorMsg?: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markFailure(profileId, errorMsg);
  } catch {
    // Profile rotation is optional — ignore errors
  }
}
