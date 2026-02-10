// Rollback Manager for self-evolution Phase 4
// Handles disable, rollback, and emergency disable operations

import { existsSync, renameSync } from 'fs';
import path from 'path';
import { MemoryStorage } from '../memory/MemoryStorage.js';
import { GenerationRegistry } from './GenerationRegistry.js';

export class RollbackManager {
  private db: ReturnType<MemoryStorage['getDatabase']>;
  private registry: GenerationRegistry;

  constructor(storage: MemoryStorage) {
    this.db = storage.getDatabase();
    this.registry = new GenerationRegistry(storage);
  }

  /**
   * Disable a single generation: DB status → 'disabled', file → .md.disabled
   */
  public disable(generationId: string): void {
    const gen = this.registry.getById(generationId);
    if (!gen) throw new Error(`Generation not found: ${generationId}`);
    if (gen.status === 'disabled' || gen.status === 'deleted') return;

    const transaction = this.db.transaction(() => {
      this.registry.updateStatus(generationId, 'disabled');

      if (gen.filePath && existsSync(gen.filePath)) {
        const disabledPath = `${gen.filePath}.disabled`;
        try {
          renameSync(gen.filePath, disabledPath);
        } catch (error) {
          // DB rollback happens via transaction abort
          throw new Error(`File rename failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    });

    transaction();
  }

  /**
   * Rollback to previous version: disable current, restore parent
   */
  public rollback(generationId: string): void {
    const gen = this.registry.getById(generationId);
    if (!gen) throw new Error(`Generation not found: ${generationId}`);
    if (!gen.parentId) throw new Error(`No parent version for: ${generationId}`);

    const parent = this.registry.getById(gen.parentId);
    if (!parent) throw new Error(`Parent generation not found: ${gen.parentId}`);

    const transaction = this.db.transaction(() => {
      // Disable current version
      this.registry.updateStatus(generationId, 'disabled');
      if (gen.filePath && existsSync(gen.filePath)) {
        try {
          renameSync(gen.filePath, `${gen.filePath}.disabled`);
        } catch { /* file may not exist */ }
      }

      // Restore parent version
      this.registry.updateStatus(gen.parentId!, 'active');
      if (parent.filePath) {
        const disabledParentPath = `${parent.filePath}.disabled`;
        if (existsSync(disabledParentPath)) {
          try {
            renameSync(disabledParentPath, parent.filePath);
          } catch (error) {
            throw new Error(`Parent restore failed: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
        }
      }
    });

    transaction();
  }

  /**
   * Emergency: disable ALL auto-generated artifacts
   */
  public emergencyDisableAll(): { disabled: number; errors: string[] } {
    const errors: string[] = [];
    let disabled = 0;

    const transaction = this.db.transaction(() => {
      // Update all non-disabled/non-deleted in DB
      const result = this.db.prepare(`
        UPDATE generations SET status = 'disabled', updatedAt = ?
        WHERE status IN ('draft', 'testing', 'active')
      `).run(new Date().toISOString());
      disabled = result.changes;

      // Rename all active files
      const activeGens = this.db.prepare(`
        SELECT filePath FROM generations WHERE status = 'disabled' AND filePath IS NOT NULL
      `).all() as Array<{ filePath: string }>;

      for (const gen of activeGens) {
        if (gen.filePath && existsSync(gen.filePath) && !gen.filePath.endsWith('.disabled')) {
          try {
            renameSync(gen.filePath, `${gen.filePath}.disabled`);
          } catch (error) {
            errors.push(`${gen.filePath}: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
        }
      }
    });

    transaction();

    if (disabled > 0) {
      process.stderr.write(`[Evolution] EMERGENCY: Disabled ${disabled} auto-generated artifacts\n`);
    }

    return { disabled, errors };
  }

  /**
   * Re-enable a disabled generation
   */
  public enable(generationId: string): void {
    const gen = this.registry.getById(generationId);
    if (!gen) throw new Error(`Generation not found: ${generationId}`);
    if (gen.status !== 'disabled') return;

    const transaction = this.db.transaction(() => {
      this.registry.updateStatus(generationId, 'active');

      if (gen.filePath) {
        const disabledPath = `${gen.filePath}.disabled`;
        if (existsSync(disabledPath)) {
          try {
            renameSync(disabledPath, gen.filePath);
          } catch (error) {
            throw new Error(`File restore failed: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
        }
      }
    });

    transaction();
  }
}
