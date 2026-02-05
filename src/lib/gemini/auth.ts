/**
 * Gemini 인증 관리
 * - OAuth 토큰 / API Key 확인 및 선택
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

import { getValidAccessToken } from '../gemini-oauth.js';
import { warnLog } from '../utils.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import type { AuthInfo } from './types.js';

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

interface GeminiCliCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_uri: string;
}

function isGeminiCliCredentials(data: unknown): data is GeminiCliCredentials {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.access_token === 'string' &&
    typeof obj.refresh_token === 'string' &&
    typeof obj.expiry_date === 'number' &&
    typeof obj.token_uri === 'string'
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
 * 인증 방식 확인 (OAuth 우선, Gemini CLI, API Key 순)
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  // 1. OAuth 토큰 확인 (우선)
  try {
    const { accessToken, email, projectId } = await getValidAccessToken();
    return { type: 'oauth', accessToken, email, projectId };
  } catch {
    // OAuth 실패 시 config에서 email 제거 (보안)
    removeEmailFromConfigIfNoToken();
  }

  // 2. Gemini CLI 크레덴셜 확인
  const cliCreds = getGeminiCliCredentials();
  if (cliCreds && cliCreds.expiry_date > Date.now() + 5 * 60 * 1000) {
    return { type: 'oauth', accessToken: cliCreds.access_token };
  }

  // 3. API Key 확인
  const apiKey = getApiKeyFromConfig();
  if (apiKey) {
    return { type: 'apikey', apiKey };
  }

  throw new Error('Gemini credentials not found. Run vibe gemini auth (OAuth) or vibe gemini key <key> (API Key) to configure.');
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
