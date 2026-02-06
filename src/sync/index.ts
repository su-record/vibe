/**
 * Sync Module Exports
 * Phase 5: Sync & Portability
 */

export { SyncStore } from './SyncStore.js';
export { SyncEngine } from './SyncEngine.js';
export { DataSerializer } from './DataSerializer.js';
export { ConflictResolver } from './ConflictResolver.js';
export { DeviceManager } from './DeviceManager.js';

export type {
  SyncTarget,
  SyncDirection,
  ConflictStrategy,
  SyncState,
  SyncStatus,
  SyncConflict,
  SyncMetadata,
  Device,
  SyncPayload,
  SerializedData,
  HLC,
  SyncConfig,
} from './types.js';

export { DEFAULT_SYNC_CONFIG } from './types.js';
