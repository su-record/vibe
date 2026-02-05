/**
 * GPT 인증 관리
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { getValidAccessToken } from '../gpt-oauth.js';
import { warnLog } from '../utils.js';
import type { AuthInfo } from './types.js';

// 전역 설정 디렉토리 경로
export function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

// API Key 가져오기 (전역 저장소)
export function getApiKeyFromConfig(): string | null {
  try {
    const globalKeyPath = path.join(getGlobalConfigDir(), 'gpt-apikey.json');
    if (fs.existsSync(globalKeyPath)) {
      const data = JSON.parse(fs.readFileSync(globalKeyPath, 'utf-8'));
      if (data.apiKey) {
        return data.apiKey;
      }
    }
  } catch (e) {
    warnLog('GPT API key read failed', e);
  }
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

// 인증 방식 확인 (OAuth 우선, API Key 대체)
export async function getAuthInfo(): Promise<AuthInfo> {
  // 1. OAuth 토큰 확인 (우선)
  try {
    const { accessToken, email } = await getValidAccessToken();
    return { type: 'oauth', accessToken, email };
  } catch {
    // OAuth 실패 시 config에서 email 제거 (보안)
    removeEmailFromConfigIfNoToken();
  }

  // 2. API Key 확인
  const apiKey = getApiKeyFromConfig();
  if (apiKey) {
    return { type: 'apikey', apiKey };
  }

  throw new Error('GPT credentials not found. Run vibe gpt auth (OAuth) or vibe gpt key <key> (API Key) to configure.');
}
