/**
 * Gemini 인증 관리
 *
 * Auth: API Key 전용 (gemini-cli / codex-cli 는 hooks에서 직접 호출)
 *
 * 환경변수:
 *   - GEMINI_API_KEY → API Key
 */

import {
  getGeminiApiKey as getGeminiApiKeyFromConfig,
} from '../config/GlobalConfigManager.js';
import type { AuthInfo } from './types.js';

/**
 * API Key 가져오기 (config.json 우선 → 환경변수 fallback)
 */
export function getApiKeyFromConfig(): string | null {
  const configKey = getGeminiApiKeyFromConfig();
  if (configKey) return configKey;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
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
    'Gemini API key not found. ' +
    'Run: vibe gemini key <key> or set GEMINI_API_KEY env var.'
  );
}
