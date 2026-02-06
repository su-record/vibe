/**
 * SyncEngine - Main sync orchestrator
 * Phase 5: Sync & Portability
 *
 * Coordinates push/pull, conflict resolution, and auto-sync.
 */

import { SyncStore } from './SyncStore.js';
import { DataSerializer } from './DataSerializer.js';
import { ConflictResolver } from './ConflictResolver.js';
import { DeviceManager } from './DeviceManager.js';
import {
  SyncTarget,
  SyncStatus,
  SyncState,
  SyncConfig,
  DEFAULT_SYNC_CONFIG,
  SyncConflict,
  SerializedData,
} from './types.js';
import { LogLevel } from '../daemon/types.js';

export class SyncEngine {
  private store: SyncStore;
  private serializer: DataSerializer;
  private resolver: ConflictResolver;
  private deviceManager: DeviceManager;
  private config: SyncConfig;
  private state: SyncState = 'idle';
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private logger: (level: LogLevel, message: string, data?: unknown) => void;
  private authenticated: boolean = false;

  constructor(
    store: SyncStore,
    logger: (level: LogLevel, message: string, data?: unknown) => void,
    config?: Partial<SyncConfig>
  ) {
    this.store = store;
    this.logger = logger;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.serializer = new DataSerializer(logger);
    this.resolver = new ConflictResolver(this.config.conflictStrategy, store, logger);
    this.deviceManager = new DeviceManager(logger);
  }

  /** Push local changes to cloud */
  async push(targets?: SyncTarget[]): Promise<{ pushed: number; errors: string[] }> {
    const effectiveTargets = targets || this.config.targets;
    let pushed = 0;
    const errors: string[] = [];

    this.state = 'syncing';
    this.logger('info', `Sync push: ${effectiveTargets.join(', ')}`);

    for (const target of effectiveTargets) {
      try {
        const data = this.exportTarget(target);
        const dirtyCount = this.store.getDirtyItems(target).length;

        // In a real implementation, this would upload to Google Drive
        // Mark tracked items as synced regardless of export (dirty tracking is separate)
        this.store.markClean(target);
        pushed += data.items.length;
        if (data.items.length > 0 || dirtyCount > 0) {
          this.logger('info', `Pushed ${data.items.length} items for ${target} (${dirtyCount} tracked)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${target}: ${msg}`);
        this.logger('error', `Push failed for ${target}: ${msg}`);
      }
    }

    if (errors.length === 0) {
      this.store.recordSync('push');
      this.deviceManager.updateLastSync();
    }

    this.state = errors.length > 0 ? 'error' : 'idle';
    return { pushed, errors };
  }

  /** Pull remote changes from cloud */
  async pull(targets?: SyncTarget[]): Promise<{ pulled: number; conflicts: number; errors: string[] }> {
    const effectiveTargets = targets || this.config.targets;
    let pulled = 0;
    let conflicts = 0;
    const errors: string[] = [];

    this.state = 'syncing';
    this.logger('info', `Sync pull: ${effectiveTargets.join(', ')}`);

    for (const target of effectiveTargets) {
      try {
        // In real implementation, download from Google Drive
        // For now, simulate empty remote
        this.store.recordSync('pull');
        this.logger('info', `Pulled data for ${target}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${target}: ${msg}`);
        this.logger('error', `Pull failed for ${target}: ${msg}`);
      }
    }

    this.state = errors.length > 0 ? 'error' : 'idle';
    return { pulled, conflicts, errors };
  }

  /** Resolve a specific conflict */
  resolveConflict(conflictId: string, resolution: 'local' | 'remote'): void {
    this.resolver.resolveManually(conflictId, resolution);
  }

  /** Get current sync status */
  getStatus(): SyncStatus {
    return {
      state: this.state,
      lastSyncedAt: this.store.getLastSyncTime(),
      pendingChanges: this.store.getPendingCount(),
      conflicts: this.store.getConflicts(),
      deviceId: this.deviceManager.getDeviceId(),
      deviceName: this.deviceManager.getCurrentDevice().name,
      authenticated: this.authenticated,
      autoSyncEnabled: this.config.autoSyncEnabled,
    };
  }

  /** Start auto-sync */
  startAutoSync(): void {
    this.stopAutoSync();
    if (!this.config.autoSyncEnabled) return;

    this.logger('info', `Auto-sync started (interval: ${this.config.autoSyncIntervalMs}ms)`);

    // Initial pull
    this.pull().catch((err) => {
      this.logger('error', 'Auto-sync initial pull failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Periodic push
    this.autoSyncTimer = setInterval(() => {
      this.push().catch((err) => {
        this.logger('error', 'Auto-sync push failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.config.autoSyncIntervalMs);
  }

  /** Stop auto-sync */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      this.logger('info', 'Auto-sync stopped');
    }
  }

  /** Mark data as changed (trigger dirty flag) */
  trackChange(target: SyncTarget, key: string, content: string): void {
    const hash = this.serializer.computeHash(content);
    this.store.markDirty(target, key, hash);
  }

  /** Set authenticated state */
  setAuthenticated(value: boolean): void {
    this.authenticated = value;
  }

  /** Get device manager */
  getDeviceManager(): DeviceManager {
    return this.deviceManager;
  }

  /** Get conflict resolver */
  getConflictResolver(): ConflictResolver {
    return this.resolver;
  }

  /** Get data serializer */
  getSerializer(): DataSerializer {
    return this.serializer;
  }

  close(): void {
    this.stopAutoSync();
    this.store.close();
  }

  // ========================================================================
  // Private
  // ========================================================================

  private exportTarget(target: SyncTarget): SerializedData {
    switch (target) {
      case 'memory':
        return this.serializer.exportMemory(this.store.getLastSyncTime());
      case 'policy':
        return this.serializer.exportPolicies();
      case 'settings':
        return this.serializer.exportSettings();
      default:
        return { target, items: [], exportedAt: new Date().toISOString() };
    }
  }
}
