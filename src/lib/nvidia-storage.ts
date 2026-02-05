/**
 * NVIDIA NIM API Key 저장/로드
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

interface NvidiaApiKeyConfig {
  apiKey: string;
  createdAt: string;
}

function getConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(os.homedir(), '.config', 'vibe');
}

function getStoragePath(): string {
  return path.join(getConfigDir(), 'nvidia-apikey.json');
}

/**
 * 하위 호환: kimi-apikey.json → nvidia-apikey.json 마이그레이션
 */
function migrateLegacyKey(): void {
  try {
    const legacyPath = path.join(getConfigDir(), 'kimi-apikey.json');
    const newPath = getStoragePath();
    if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
      fs.copyFileSync(legacyPath, newPath);
      fs.unlinkSync(legacyPath);
    }
  } catch { /* ignore */ }
}

export function loadApiKey(): string | null {
  try {
    migrateLegacyKey();
    const storagePath = getStoragePath();
    if (!fs.existsSync(storagePath)) return null;
    const content = fs.readFileSync(storagePath, 'utf-8');
    const config = JSON.parse(content) as NvidiaApiKeyConfig;
    return config.apiKey || null;
  } catch {
    return null;
  }
}

export function saveApiKey(apiKey: string): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const config: NvidiaApiKeyConfig = {
    apiKey,
    createdAt: new Date().toISOString(),
  };
  const storagePath = getStoragePath();
  fs.writeFileSync(storagePath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function removeApiKey(): boolean {
  const storagePath = getStoragePath();
  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath);
    return true;
  }
  return false;
}

export function hasApiKey(): boolean {
  return loadApiKey() !== null;
}

/**
 * API Key 마스킹 (nva***last4)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 7) return '***';
  return `${key.slice(0, 3)}***${key.slice(-4)}`;
}
