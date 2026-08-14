/**
 * ConfigManager - Centralized configuration directory management
 *
 * 모든 설정은 ~/.vibe/ 에 통합 (플랫폼 무관).
 * getGlobalConfigDir()은 getVibeDir()로 위임.
 */
import fs from 'fs';
import path from 'path';
import { getVibeDir } from '../../config/GlobalConfigManager.js';
/**
 * Get the global core configuration directory (= ~/.vibe/)
 */
export function getGlobalConfigDir() {
    return getVibeDir();
}
/**
 * Get the provider-specific config file path
 */
export function getProviderConfigPath(provider) {
    const configDir = getGlobalConfigDir();
    const filename = provider === 'gpt' ? 'gpt-apikey.json' : 'antigravity-apikey.json';
    return path.join(configDir, filename);
}
/**
 * Get the provider-specific OAuth token path
 */
export function getOAuthTokenPath(provider) {
    const configDir = getGlobalConfigDir();
    const filename = provider === 'gpt' ? 'gpt' : 'antigravity';
    return path.join(configDir, filename, 'tokens.json');
}
/**
 * Ensure the config directory exists
 */
export function ensureConfigDir() {
    const configDir = getGlobalConfigDir();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
}
/**
 * Read JSON config file safely
 */
export function readJsonConfig(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Write JSON config file
 */
export function writeJsonConfig(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
//# sourceMappingURL=ConfigManager.js.map