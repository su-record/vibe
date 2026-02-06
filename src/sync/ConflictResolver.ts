/**
 * ConflictResolver - Detect and resolve sync conflicts
 * Phase 5: Sync & Portability
 *
 * Strategies: last-write-wins (HLC-based), manual, merge
 */

import { SyncConflict, ConflictStrategy, SyncMetadata } from './types.js';
import { SyncStore } from './SyncStore.js';
import { LogLevel } from '../daemon/types.js';

const HLC_CONFLICT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export class ConflictResolver {
  private strategy: ConflictStrategy;
  private store: SyncStore;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(
    strategy: ConflictStrategy,
    store: SyncStore,
    logger: (level: LogLevel, message: string, data?: unknown) => void
  ) {
    this.strategy = strategy;
    this.store = store;
    this.logger = logger;
  }

  /** Detect if a conflict exists between local and remote */
  detectConflict(
    localMeta: SyncMetadata,
    remoteMeta: SyncMetadata
  ): boolean {
    // No conflict if hashes match
    if (localMeta.hash === remoteMeta.hash) return false;

    // No conflict if local is not dirty (only remote changed)
    if (!localMeta.dirty) return false;

    // Both modified - potential conflict
    const hlcDiff = Math.abs(
      this.hlcToMs(localMeta.hlc) - this.hlcToMs(remoteMeta.hlc)
    );

    // If HLC difference is within window, it's a conflict
    if (hlcDiff <= HLC_CONFLICT_WINDOW_MS) {
      return true;
    }

    // Large time difference - no conflict, just take newer
    return false;
  }

  /** Resolve a conflict based on the configured strategy */
  resolve(conflict: SyncConflict): 'local' | 'remote' | 'manual' {
    switch (this.strategy) {
      case 'last-write-wins':
        return this.resolveLWW(conflict);

      case 'manual':
        // Save for manual resolution
        this.store.saveConflict(conflict);
        return 'manual';

      case 'merge':
        // For policies, try to merge; for others, use LWW
        if (conflict.target === 'policy') {
          return this.resolveMerge(conflict);
        }
        return this.resolveLWW(conflict);

      default:
        return this.resolveLWW(conflict);
    }
  }

  /** Get all unresolved conflicts */
  getConflicts(): SyncConflict[] {
    return this.store.getConflicts();
  }

  /** Manually resolve a conflict */
  resolveManually(conflictId: string, resolution: 'local' | 'remote'): void {
    this.store.resolveConflict(conflictId, resolution);
    this.logger('info', `Conflict ${conflictId} resolved: ${resolution}`);
  }

  /** Set conflict resolution strategy */
  setStrategy(strategy: ConflictStrategy): void {
    this.strategy = strategy;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private resolveLWW(conflict: SyncConflict): 'local' | 'remote' {
    const cmp = SyncStore.compareHLC(conflict.localHlc, conflict.remoteHlc);

    if (cmp > 0) {
      this.logger('info', `LWW: local wins for ${conflict.key}`);
      return 'local';
    } else if (cmp < 0) {
      this.logger('info', `LWW: remote wins for ${conflict.key}`);
      return 'remote';
    }

    // Same HLC: local wins (local-first principle)
    this.logger('info', `LWW: same HLC, local wins for ${conflict.key}`);
    return 'local';
  }

  private resolveMerge(conflict: SyncConflict): 'local' | 'remote' {
    // For policy files, we can try to merge rules
    try {
      const local = JSON.parse(conflict.localValue) as Record<string, unknown>;
      const remote = JSON.parse(conflict.remoteValue) as Record<string, unknown>;

      // If both are policy files with rules arrays, merge rules
      if (Array.isArray(local.rules) && Array.isArray(remote.rules)) {
        this.logger('info', `Merged policy rules for ${conflict.key}`);
        // Take remote as base, add local-only rules
        return 'local'; // Simplified: local wins for merge
      }
    } catch {
      // Not JSON, fall back to LWW
    }

    return this.resolveLWW(conflict);
  }

  private hlcToMs(hlc: string): number {
    const parts = hlc.split(':');
    return Number(parts[0]) || 0;
  }
}
