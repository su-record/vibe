/**
 * LLM Auth Module - Centralized authentication management
 */

export * from './ConfigManager.js';
export * from './ApiKeyManager.js';
export { TokenRefresher, tokenRefresher } from './TokenRefresher.js';
export type { RefreshResult, ReadCurrentTokenFn } from './TokenRefresher.js';
export { AuthProfileManager, getAuthProfileManager } from './AuthProfileManager.js';
export type { AuthProfile, AuthProfileProvider } from './AuthProfileManager.js';
export { ProfileFileLock } from './ProfileFileLock.js';

import type { AuthInfo, LLMProvider } from '../types.js';
import { getApiKey } from './ApiKeyManager.js';

/**
 * Get authentication info for a provider (API Key only)
 */
export async function getAuthInfo(provider: LLMProvider): Promise<AuthInfo> {
  const apiKey = getApiKey(provider);
  if (apiKey) {
    return { type: 'apikey', apiKey };
  }

  const providerName = provider === 'gpt' ? 'GPT' : 'Gemini';
  throw new Error(
    `${providerName} not configured. Run 'vibe ${provider} key <key>' to set up authentication.`
  );
}

/**
 * Check if a provider has any authentication configured
 */
export function hasAuth(provider: LLMProvider): boolean {
  const apiKey = getApiKey(provider);
  return Boolean(apiKey);
}
