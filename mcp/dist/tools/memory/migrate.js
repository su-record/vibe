#!/usr/bin/env node
// Migration utility to convert JSON memories to SQLite
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { getMemoryDir } from './memoryConfig.js';
import { saveMemory } from './memorySQLite.js';
import { memoryDB } from './database.js';
/**
 * Migrate from JSON to SQLite
 */
export async function migrateFromJSON() {
    const memoryDir = getMemoryDir();
    const jsonPath = path.join(memoryDir, 'memories.json');
    const result = {
        success: false,
        migrated: 0,
        errors: []
    };
    // Check if JSON file exists
    if (!existsSync(jsonPath)) {
        result.errors.push('No legacy memories.json file found');
        return result;
    }
    try {
        // Read JSON file
        const jsonData = readFileSync(jsonPath, 'utf-8');
        const memories = JSON.parse(jsonData);
        console.log(`Found ${memories.length} memories to migrate`);
        // Migrate each memory
        for (const memory of memories) {
            try {
                saveMemory(memory.key, memory.value, memory.category);
                result.migrated++;
            }
            catch (error) {
                result.errors.push(`Failed to migrate key "${memory.key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        result.success = true;
        console.log(`✅ Successfully migrated ${result.migrated} memories`);
        if (result.errors.length > 0) {
            console.warn(`⚠️  ${result.errors.length} errors occurred during migration:`);
            result.errors.forEach(err => console.warn(`   ${err}`));
        }
    }
    catch (error) {
        result.errors.push(`Failed to read JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return result;
}
/**
 * Export SQLite database to JSON (for backup)
 */
export async function exportToJSON(outputPath) {
    const db = memoryDB.getConnection();
    const stmt = db.prepare('SELECT * FROM memories');
    const memories = stmt.all();
    const exportPath = outputPath || path.join(getMemoryDir(), `backup-${Date.now()}.json`);
    try {
        const { writeFileSync } = await import('fs');
        writeFileSync(exportPath, JSON.stringify(memories, null, 2));
        return {
            success: true,
            exported: memories.length,
            path: exportPath
        };
    }
    catch (error) {
        throw new Error(`Failed to export: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
}
// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    switch (command) {
        case 'migrate':
            console.log('🔄 Starting migration from JSON to SQLite...');
            migrateFromJSON().then(result => {
                if (result.success) {
                    console.log(`\n✅ Migration completed: ${result.migrated} memories migrated`);
                    process.exit(0);
                }
                else {
                    console.error('\n❌ Migration failed');
                    process.exit(1);
                }
            });
            break;
        case 'export':
            console.log('📦 Exporting SQLite to JSON...');
            exportToJSON().then(result => {
                console.log(`\n✅ Export completed: ${result.exported} memories exported to ${result.path}`);
                process.exit(0);
            }).catch(error => {
                console.error(`\n❌ Export failed: ${error.message}`);
                process.exit(1);
            });
            break;
        default:
            console.log(`
Hi-AI Memory Migration Tool

Usage:
  node dist/tools/memory/migrate.js migrate    Migrate from JSON to SQLite
  node dist/tools/memory/migrate.js export     Export SQLite to JSON backup

Options:
  migrate    Convert memories.json to SQLite database
  export     Create JSON backup of SQLite database
      `);
            break;
    }
}
