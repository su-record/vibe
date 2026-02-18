/**
 * ConfigManager - Centralized configuration directory management
 *
 * 모든 설정은 ~/.vibe/ 에 통합 (플랫폼 무관).
 * getGlobalConfigDir()은 getVibeDir()로 위임.
 */

import fs from 'fs';
import path from 'path';
import type { LLMProvider } from '../types.js';
import { getVibeDir } from '../../config/GlobalConfigManager.js';

/**
 * Get the global core configuration directory (= ~/.vibe/)
 */
export function getGlobalConfigDir(): string {
  return getVibeDir();
}

/**
 * Get the provider-specific config file path
 */
export function getProviderConfigPath(provider: LLMProvider): string {
  const configDir = getGlobalConfigDir();
  const filename = provider === 'gpt' ? 'gpt-apikey.json' : 'gemini-apikey.json';
  return path.join(configDir, filename);
}

/**
 * Get the provider-specific OAuth token path
 */
export function getOAuthTokenPath(provider: LLMProvider): string {
  const configDir = getGlobalConfigDir();
  const filename = provider === 'gpt' ? 'gpt' : 'gemini';
  return path.join(configDir, filename, 'tokens.json');
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  const configDir = getGlobalConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Read JSON config file safely
 */
export function readJsonConfig<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON config file
 */
export function writeJsonConfig<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
