/**
 * ApiKeyManager - API key storage and retrieval
 */

import type { LLMProvider } from '../types.js';
import { getProviderConfigPath, readJsonConfig, writeJsonConfig, ensureConfigDir } from './ConfigManager.js';

interface ApiKeyConfig {
  apiKey: string;
  createdAt?: string;
}

/**
 * Get API key from config file
 */
export function getApiKey(provider: LLMProvider): string | null {
  const configPath = getProviderConfigPath(provider);
  const config = readJsonConfig<ApiKeyConfig>(configPath);
  return config?.apiKey || null;
}

/**
 * Save API key to config file
 */
export function saveApiKey(provider: LLMProvider, apiKey: string): void {
  ensureConfigDir();
  const configPath = getProviderConfigPath(provider);
  const config: ApiKeyConfig = {
    apiKey,
    createdAt: new Date().toISOString(),
  };
  writeJsonConfig(configPath, config);
}

/**
 * Remove API key from config
 */
export function removeApiKey(provider: LLMProvider): boolean {
  const configPath = getProviderConfigPath(provider);
  const config = readJsonConfig<ApiKeyConfig>(configPath);
  if (config?.apiKey) {
    writeJsonConfig(configPath, {});
    return true;
  }
  return false;
}

/**
 * Check if API key exists
 */
export function hasApiKey(provider: LLMProvider): boolean {
  return getApiKey(provider) !== null;
}
