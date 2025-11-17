// Shared memory utilities
import { promises as fs } from 'fs';
import { getMemoryDir, getMemoryFile } from './memoryConfig.js';
/**
 * Ensure memory directory exists
 */
export async function ensureMemoryDir() {
    try {
        await fs.access(getMemoryDir());
    }
    catch {
        await fs.mkdir(getMemoryDir(), { recursive: true });
    }
}
/**
 * Load all memories from file
 */
export async function loadMemories() {
    try {
        await ensureMemoryDir();
        const data = await fs.readFile(getMemoryFile(), 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
/**
 * Save memories to file
 */
export async function saveMemories(memories) {
    await ensureMemoryDir();
    await fs.writeFile(getMemoryFile(), JSON.stringify(memories, null, 2));
}
