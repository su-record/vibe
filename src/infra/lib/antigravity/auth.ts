/**
 * Antigravity API 인증 관리
 *
 * Auth: API Key 전용 (Antigravity CLI / Codex CLI 는 hooks에서 직접 호출)
 *
 * 환경변수:
 *   - ANTIGRAVITY_API_KEY → API Key
 */

import {
  getAntigravityApiKey,
} from '../config/GlobalConfigManager.js';
import type { AuthInfo } from './types.js';

/**
 * API Key 가져오기 (config.json 우선 → 환경변수 fallback)
 */
export function getApiKeyFromConfig(): string | null {
  const configKey = getAntigravityApiKey();
  if (configKey) return configKey;
  if (process.env.ANTIGRAVITY_API_KEY) return process.env.ANTIGRAVITY_API_KEY;
  return null;
}

/**
 * 인증 정보 반환 (API Key 전용)
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  const apiKey = getApiKeyFromConfig();
  if (apiKey) {
    return { type: 'apikey', apiKey };
  }

  throw new Error(
    'Antigravity API key not found. ' +
    'Run: vibe antigravity key <key> or set ANTIGRAVITY_API_KEY env var.'
  );
}
