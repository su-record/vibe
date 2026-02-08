/**
 * Kimi Direct API (Moonshot) 인증 관리
 * API Key only
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

import type { AuthInfo } from './types.js';

function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(os.homedir(), '.config', 'vibe');
}

function getApiKeyFromConfig(): string | null {
  const configDir = getGlobalConfigDir();

  try {
    const keyPath = path.join(configDir, 'kimi-apikey.json');
    if (fs.existsSync(keyPath)) {
      const data: unknown = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      if (data && typeof data === 'object' && 'apiKey' in data) {
        const apiKey = (data as { apiKey: unknown }).apiKey;
        if (typeof apiKey === 'string') return apiKey;
      }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * 인증 정보 가져오기 (환경변수 → 저장 파일)
 */
export async function getAuthInfo(): Promise<AuthInfo> {
  // 환경변수 확인
  const envKey = process.env.KIMI_API_KEY;
  if (envKey) {
    return { type: 'apikey', apiKey: envKey };
  }

  // 저장된 API Key 확인
  const storedKey = getApiKeyFromConfig();
  if (storedKey) {
    return { type: 'apikey', apiKey: storedKey };
  }

  throw new Error('Kimi API credentials not found. Run "vibe kimi key <api-key>" or set KIMI_API_KEY env variable.');
}
