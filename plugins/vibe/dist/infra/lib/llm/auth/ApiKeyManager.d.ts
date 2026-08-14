/**
 * ApiKeyManager - API key storage and retrieval
 */
import type { LLMProvider } from '../types.js';
/**
 * Get API key from config file
 */
export declare function getApiKey(provider: LLMProvider): string | null;
/**
 * Save API key to config file
 */
export declare function saveApiKey(provider: LLMProvider, apiKey: string): void;
/**
 * Remove API key from config
 */
export declare function removeApiKey(provider: LLMProvider): boolean;
/**
 * Check if API key exists
 */
export declare function hasApiKey(provider: LLMProvider): boolean;
//# sourceMappingURL=ApiKeyManager.d.ts.map