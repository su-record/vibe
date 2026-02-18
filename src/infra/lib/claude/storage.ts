/**
 * Claude API Key 저장/로드
 */

import fs from 'fs';
import path from 'path';
import { getGlobalConfigDir } from '../llm/auth/ConfigManager.js';

interface ClaudeApiKeyConfig {
  apiKey: string;
  createdAt: string;
}

function getStoragePath(): string {
  return path.join(getGlobalConfigDir(), 'claude-apikey.json');
}

export function loadApiKey(): string | null {
  try {
    const storagePath = getStoragePath();
    if (!fs.existsSync(storagePath)) return null;
    const content = fs.readFileSync(storagePath, 'utf-8');
    const config = JSON.parse(content) as ClaudeApiKeyConfig;
    return config.apiKey || null;
  } catch {
    return null;
  }
}

export function saveApiKey(apiKey: string): void {
  const configDir = getGlobalConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const config: ClaudeApiKeyConfig = {
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
 * API Key 마스킹 (key***last4)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 7) return '***';
  return `${key.slice(0, 3)}***${key.slice(-4)}`;
}
