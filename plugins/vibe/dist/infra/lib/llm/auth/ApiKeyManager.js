/**
 * ApiKeyManager - API key storage and retrieval
 */
import { getProviderConfigPath, readJsonConfig, writeJsonConfig, ensureConfigDir } from './ConfigManager.js';
/**
 * Get API key from config file
 */
export function getApiKey(provider) {
    const configPath = getProviderConfigPath(provider);
    const config = readJsonConfig(configPath);
    return config?.apiKey || null;
}
/**
 * Save API key to config file
 */
export function saveApiKey(provider, apiKey) {
    ensureConfigDir();
    const configPath = getProviderConfigPath(provider);
    const config = {
        apiKey,
        createdAt: new Date().toISOString(),
    };
    writeJsonConfig(configPath, config);
}
/**
 * Remove API key from config
 */
export function removeApiKey(provider) {
    const configPath = getProviderConfigPath(provider);
    const config = readJsonConfig(configPath);
    if (config?.apiKey) {
        writeJsonConfig(configPath, {});
        return true;
    }
    return false;
}
/**
 * Check if API key exists
 */
export function hasApiKey(provider) {
    return getApiKey(provider) !== null;
}
//# sourceMappingURL=ApiKeyManager.js.map