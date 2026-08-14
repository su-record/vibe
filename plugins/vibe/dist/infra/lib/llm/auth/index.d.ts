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
/**
 * Get authentication info for a provider (API Key only)
 */
export declare function getAuthInfo(provider: LLMProvider): Promise<AuthInfo>;
/**
 * Check if a provider has any authentication configured
 */
export declare function hasAuth(provider: LLMProvider): boolean;
//# sourceMappingURL=index.d.ts.map