/**
 * Azure Foundry 인증 관리
 * API Key only
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

import { getAuthProfileManager } from '../llm/auth/AuthProfileManager.js';
import type { AuthInfo } from './types.js';

function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(os.homedir(), '.config', 'vibe');
}

function getApiKeyFromConfig(): string | null {
  const configDir = getGlobalConfigDir();

  try {
    const keyPath = path.join(configDir, 'az-apikey.json');
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
  const envKey = process.env.AZ_API_KEY;
  if (envKey) {
    return { type: 'apikey', apiKey: envKey };
  }

  // 2. 저장된 API Key 확인
  const storedKey = getApiKeyFromConfig();
  if (storedKey) {
    return { type: 'apikey', apiKey: storedKey };
  }

  throw new Error('Azure Foundry credentials not found. Run "vibe az key <api-key>" or set AZ_API_KEY env variable.');
}

/**
 * Auth Profile 기반 성공/실패 마킹 (optional)
 */
export async function markAuthSuccess(profileId: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markSuccess(profileId);
  } catch {
    // Profile rotation is optional
  }
}

export async function markAuthFailure(profileId: string, errorMsg?: string): Promise<void> {
  try {
    const manager = getAuthProfileManager();
    await manager.markFailure(profileId, errorMsg);
  } catch {
    // Profile rotation is optional
  }
}
