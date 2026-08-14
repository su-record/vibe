/**
 * ConfigManager - Centralized configuration directory management
 *
 * 모든 설정은 ~/.vibe/ 에 통합 (플랫폼 무관).
 * getGlobalConfigDir()은 getVibeDir()로 위임.
 */
import type { LLMProvider } from '../types.js';
/**
 * Get the global core configuration directory (= ~/.vibe/)
 */
export declare function getGlobalConfigDir(): string;
/**
 * Get the provider-specific config file path
 */
export declare function getProviderConfigPath(provider: LLMProvider): string;
/**
 * Get the provider-specific OAuth token path
 */
export declare function getOAuthTokenPath(provider: LLMProvider): string;
/**
 * Ensure the config directory exists
 */
export declare function ensureConfigDir(): void;
/**
 * Read JSON config file safely
 */
export declare function readJsonConfig<T>(filePath: string): T | null;
/**
 * Write JSON config file
 */
export declare function writeJsonConfig<T>(filePath: string, data: T): void;
//# sourceMappingURL=ConfigManager.d.ts.map