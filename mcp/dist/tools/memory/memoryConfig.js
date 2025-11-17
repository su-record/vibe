// Memory configuration - centralized path management
import path from 'path';
/**
 * Get memory directory path
 * Respects HI_AI_MEMORY_DIR environment variable
 */
export function getMemoryDir() {
    return process.env.HI_AI_MEMORY_DIR || path.join(process.cwd(), 'memories');
}
/**
 * Get memory file path
 */
export function getMemoryFile() {
    return path.join(getMemoryDir(), 'memories.json');
}
/**
 * Get session context directory
 */
export function getSessionDir() {
    return path.join(getMemoryDir(), 'sessions');
}
/**
 * Get guides directory
 */
export function getGuidesDir() {
    return process.env.HI_AI_GUIDES_DIR || path.join(process.cwd(), 'guides');
}
