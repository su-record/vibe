import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { saveMemory, saveMemoryDefinition } from '../tools/memory/saveMemory.js';
import { recallMemory } from '../tools/memory/recallMemory.js';
import { listMemories } from '../tools/memory/listMemories.js';
import { deleteMemory } from '../tools/memory/deleteMemory.js';
import { memoryDB } from '../tools/memory/database.js';
import { clearAllMemories } from '../tools/memory/memorySQLite.js';
import { promises as fs } from 'fs';
import path from 'path';
const TEST_MEMORY_DIR = path.join(process.cwd(), 'memories');
describe('Memory Management Tools', () => {
    beforeEach(async () => {
        // Ensure fresh database for each test
        try {
            // Close existing connection if any
            memoryDB.close();
        }
        catch (error) {
            // Ignore
        }
        // Clean up test files
        try {
            await fs.rm(TEST_MEMORY_DIR, { recursive: true, force: true });
        }
        catch (error) {
            // Ignore
        }
        // Clear all memories (this will recreate DB if needed)
        try {
            clearAllMemories();
        }
        catch (error) {
            // Database might not exist yet, will be created on first use
        }
    });
    afterEach(async () => {
        // Close database connection
        try {
            memoryDB.close();
        }
        catch (error) {
            // Ignore
        }
    });
    describe('saveMemory', () => {
        test('should save memory successfully', async () => {
            const result = await saveMemory({
                key: 'test-key',
                value: 'test-value',
                category: 'project'
            });
            expect(result.content[0].text).toContain('success');
            expect(result.content[0].text).toContain('test-key');
        });
        test('should create memory database if not exists', async () => {
            await saveMemory({ key: 'test-key', value: 'test-value' });
            // Check if database file exists
            const dbPath = path.join(TEST_MEMORY_DIR, 'memories.db');
            const dbExists = await fs.access(dbPath).then(() => true).catch(() => false);
            expect(dbExists).toBe(true);
        });
    });
    describe('recallMemory', () => {
        test('should recall saved memory', async () => {
            await saveMemory({ key: 'recall-test', value: 'recall-value' });
            const result = await recallMemory({ key: 'recall-test' });
            const parsedResult = JSON.parse(result.content[0].text.replace('Memory recalled:\n', ''));
            expect(parsedResult.value).toBe('recall-value');
            expect(parsedResult.key).toBe('recall-test');
        });
        test('should return not found for non-existent key', async () => {
            const result = await recallMemory({ key: 'non-existent' });
            expect(result.content[0].text).toContain('not found');
        });
    });
    describe('listMemories', () => {
        test('should list all memories', async () => {
            await saveMemory({ key: 'key1', value: 'value1', category: 'project' });
            await saveMemory({ key: 'key2', value: 'value2', category: 'code' });
            const result = await listMemories({ summary: false });
            const parsed = JSON.parse(result.content[0].text.replace('Memory list:\n', ''));
            expect(parsed.memories.length).toBe(2);
            expect(parsed.total).toBe(2);
        });
        test('should filter memories by category', async () => {
            await saveMemory({ key: 'project1', value: 'val1', category: 'project' });
            await saveMemory({ key: 'code1', value: 'val2', category: 'code' });
            const result = await listMemories({ category: 'project', summary: false });
            const parsed = JSON.parse(result.content[0].text.replace('Memory list:\n', ''));
            expect(parsed.total).toBe(1);
            expect(parsed.memories[0].key).toBe('project1');
        });
        test('should return empty array when no memories exist', async () => {
            const result = await listMemories({ summary: false });
            const parsed = JSON.parse(result.content[0].text.replace('Memory list:\n', ''));
            expect(parsed.memories).toEqual([]);
            expect(parsed.total).toBe(0);
        });
    });
    describe('deleteMemory', () => {
        test('should delete existing memory', async () => {
            await saveMemory({ key: 'delete-me', value: 'temporary' });
            const deleteResult = await deleteMemory({ key: 'delete-me' });
            expect(deleteResult.content[0].text).toContain('success');
            const recallResult = await recallMemory({ key: 'delete-me' });
            expect(recallResult.content[0].text).toContain('not found');
        });
    });
    describe('Tool Definition', () => {
        test('should have correct structure', () => {
            expect(saveMemoryDefinition.name).toBe('save_memory');
            expect(saveMemoryDefinition.description).toContain('IMPORTANT');
            expect(saveMemoryDefinition.inputSchema.required).toContain('key');
        });
        test('should include keyword triggers', () => {
            expect(saveMemoryDefinition.description).toContain('기억해');
            expect(saveMemoryDefinition.description).toContain('remember');
        });
    });
});
