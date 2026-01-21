/**
 * ConfigManager - Centralized configuration directory management
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { LLMProvider } from '../types.js';

/**
 * Get the global vibe configuration directory
 */
export function getGlobalConfigDir(): string {
  const homeDir = os.homedir();
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'vibe');
  }
  return path.join(homeDir, '.config', 'vibe');
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
