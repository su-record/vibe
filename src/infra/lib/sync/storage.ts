/**
 * vibe sync — sync OAuth 토큰 저장/로드 (sync-auth.json)
 */

import fs from 'fs';
import path from 'path';
import { getGlobalConfigDir } from '../llm/auth/ConfigManager.js';

export interface SyncAuthTokens {
  accessToken: string;
  refreshToken: string;
  expires: number;
  email?: string;
}

export interface SyncAuthStorage {
  version: number;
  accessToken: string;
  refreshToken: string;
  expires: number;
  email?: string;
  encryptionKey?: string; // base64, AES-256 키 (없으면 push 시 생성해 저장)
}

export function getSyncAuthPath(): string {
  return path.join(getGlobalConfigDir(), 'sync-auth.json');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadSyncAuth(): SyncAuthStorage | null {
  try {
    const p = getSyncAuthPath();
    if (!fs.existsSync(p)) return null;
    const content = fs.readFileSync(p, 'utf-8');
    return JSON.parse(content) as SyncAuthStorage;
  } catch {
    return null;
  }
}

export function saveSyncAuth(data: SyncAuthStorage): void {
  const p = getSyncAuthPath();
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
}
