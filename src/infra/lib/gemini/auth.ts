/**
 * Gemini 인증 관리
 * - 고정 순서: gemini-cli → oauth → apikey
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

import { getValidAccessToken } from '../gemini-oauth.js';
import { warnLog } from '../utils.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import {
  ANTIGRAVITY_ENDPOINT_PROD,
  ANTIGRAVITY_HEADERS,
} from '../gemini-constants.js';
import type { AuthInfo, GeminiAuthMethod } from './types.js';

// 고정 인증 순서: oauth → apikey → gemini-cli
const AUTH_ORDER: GeminiAuthMethod[] = ['oauth', 'apikey', 'gemini-cli'];

/**
 * 전역 설정 디렉토리 경로
 */
export function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

/**
 * API Key 가져오기 (전역 저장소)
 */
export function getApiKeyFromConfig(): string | null {
  try {
    const globalKeyPath = path.join(getGlobalConfigDir(), 'gemini-apikey.json');
    if (fs.existsSync(globalKeyPath)) {
      const data = JSON.parse(fs.readFileSync(globalKeyPath, 'utf-8'));
      if (data.apiKey) {
        return data.apiKey;
      }
    }
  } catch (e) {
    warnLog('Gemini API key read failed', e);
  }
  return null;
}

/**
 * OAuth 토큰 없을 때 config에서 email 제거
 */
export function removeEmailFromConfigIfNoToken(): void {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.gemini?.email) {
        delete config.models.gemini.email;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    }
  } catch (e) {
    warnLog('Failed to remove email from Gemini config', e);
  }
}

/**
 * Gemini CLI 크레덴셜 검색 경로
 */
const GEMINI_CLI_CREDENTIAL_PATHS = [
  path.join(os.homedir(), '.gemini', 'oauth_creds.json'),
  path.join(os.homedir(), '.config', 'gemini-cli', 'oauth_creds.json'),
];

// Google OAuth 기본 토큰 갱신 엔드포인트
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

interface GeminiCliCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_uri?: string;
}

function isGeminiCliCredentials(data: unknown): data is GeminiCliCredentials {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.access_token === 'string' &&
    typeof obj.refresh_token === 'string' &&
    typeof obj.expiry_date === 'number'
  );
}

/**
 * Gemini CLI 크레덴셜 탐색 (read-only)
 * Symlink 거부, 소유자 확인 (macOS/Linux), 권한 0o600 이하
 */
export function getGeminiCliCredentials(): GeminiCliCredentials | null {
  for (const credPath of GEMINI_CLI_CREDENTIAL_PATHS) {
    try {
      const stat = fs.lstatSync(credPath);

      // Symlink 거부
      if (stat.isSymbolicLink()) continue;
      if (!stat.isFile()) continue;

      // 소유자 확인 (macOS/Linux)
      if (process.platform !== 'win32') {
        const uid = process.getuid?.();
        if (uid !== undefined && stat.uid !== uid) continue;

        // 권한 확인: 0o600 이하
        const mode = stat.mode & 0o777;
        if ((mode & 0o077) !== 0) continue;
      }

      const content = fs.readFileSync(credPath, 'utf-8');
      const data: unknown = JSON.parse(content);

      if (!isGeminiCliCredentials(data)) continue;

      return data;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Gemini CLI 토큰 갱신
 */
async function refreshGeminiCliToken(
  creds: GeminiCliCredentials
): Promise<GeminiCliCredentials | null> {
  try {
    // Gemini CLI의 client_id/client_secret 읽기
    const clientCredsPath = path.join(os.homedir(), '.gemini', 'oauth_client.json');
    let clientId = '';
    let clientSecret = '';

    if (fs.existsSync(clientCredsPath)) {
      const clientData: unknown = JSON.parse(fs.readFileSync(clientCredsPath, 'utf-8'));
      if (clientData && typeof clientData === 'object') {
        const obj = clientData as Record<string, unknown>;
        if (typeof obj.client_id === 'string') clientId = obj.client_id;
        if (typeof obj.client_secret === 'string') clientSecret = obj.client_secret;
      }
    }

    // client_id가 없으면 Gemini CLI 기본값 사용
    if (!clientId) {
      clientId = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
      clientSecret = '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';
    }

    const tokenUri = creds.token_uri || DEFAULT_TOKEN_URI;
    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return null;

    const result = data as Record<string, unknown>;
    const newAccessToken = result.access_token;
    if (typeof newAccessToken !== 'string') return null;

    const expiresIn = typeof result.expires_in === 'number' ? result.expires_in : 3600;
    const newCreds: GeminiCliCredentials = {
      access_token: newAccessToken,
      refresh_token: creds.refresh_token,
      expiry_date: Date.now() + expiresIn * 1000,
      token_uri: tokenUri,
    };

    // 갱신된 토큰을 파일에 저장
    const credPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
    fs.writeFileSync(credPath, JSON.stringify(newCreds, null, 2), { mode: 0o600 });

    return newCreds;
  } catch {
    return null;
  }
}

/**
 * loadCodeAssist API로 projectId 획득
 * Gemini CLI OAuth 토큰으로 Antigravity 엔드포인트에 접근하려면
 * 먼저 loadCodeAssist를 호출해서 cloudaicompanionProject를 받아야 함
 */
async function loadCodeAssistProjectId(accessToken: string): Promise<string | null> {
  try {
    const url = `${ANTIGRAVITY_ENDPOINT_PROD}/v1internal:loadCodeAssist`;
    const metadata = JSON.parse(
      ANTIGRAVITY_HEADERS['Client-Metadata']
    ) as Record<string, unknown>;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...ANTIGRAVITY_HEADERS,
      },
      body: JSON.stringify({ metadata }),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return null;

    const result = data as Record<string, unknown>;
    if (typeof result.cloudaicompanionProject === 'string') {
      return result.cloudaicompanionProject;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 개별 인증 방식 시도
 */
async function tryAuthMethod(method: GeminiAuthMethod): Promise<AuthInfo | null> {
  switch (method) {
    case 'oauth': {
      try {
        const { accessToken, email, projectId } = await getValidAccessToken();
        return { type: 'oauth', accessToken, email, projectId };
      } catch {
        removeEmailFromConfigIfNoToken();
        return null;
      }
    }
    case 'gemini-cli': {
      const cliCreds = getGeminiCliCredentials();
      if (!cliCreds) return null;

      let token = cliCreds.access_token;

      // 토큰 만료 시 갱신
      if (cliCreds.expiry_date <= Date.now() + 5 * 60 * 1000) {
        if (!cliCreds.refresh_token) return null;
        const refreshed = await refreshGeminiCliToken(cliCreds);
        if (!refreshed) return null;
        token = refreshed.access_token;
      }

      // loadCodeAssist로 projectId 획득 (Antigravity 엔드포인트 사용에 필수)
      const projectId = await loadCodeAssistProjectId(token);

      return {
        type: 'gemini-cli',
        accessToken: token,
        projectId: projectId || undefined,
        refreshToken: cliCreds.refresh_token,
        tokenUri: cliCreds.token_uri || DEFAULT_TOKEN_URI,
        expiryDate: cliCreds.expiry_date,
      };
    }
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
 * 인증 방식 확인 (고정 순서: gemini-cli → oauth → apikey)
 * 순서대로 시도, 실패 시 다음 방식으로 fallback
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  for (const method of AUTH_ORDER) {
    const auth = await tryAuthMethod(method);
    if (auth) return auth;
  }

  throw new Error(
    'Gemini credentials not found. Tried: gemini-cli, oauth, apikey. ' +
    'Run vibe gemini auth (OAuth) or vibe gemini key <key> (API Key) to configure.'
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
