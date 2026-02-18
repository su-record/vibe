/**
 * GPT 인증 관리
 * - 고정 순서: oauth → apikey
 */

import path from 'path';
import fs from 'fs';
import { getValidAccessToken } from './oauth.js';
import { warnLog } from '../utils.js';
import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import { getGptApiKey } from '../config/GlobalConfigManager.js';
import type { AuthInfo, GptAuthMethod } from './types.js';

// 고정 인증 순서: oauth → apikey
const AUTH_ORDER: GptAuthMethod[] = ['oauth', 'apikey'];

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
 * 인증 방식 확인 (고정 순서: oauth → apikey)
 * 순서대로 시도, 실패 시 다음 방식으로 fallback
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  for (const method of AUTH_ORDER) {
    const auth = await tryAuthMethod(method);
    if (auth) return auth;
  }

  throw new Error(
    'GPT credentials not found. Tried: oauth, apikey. ' +
    'Run vibe gpt auth (OAuth) or vibe gpt key <key> (API Key) to configure.'
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
