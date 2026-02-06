/**
 * Sync & Portability Type Definitions
 * Phase 5: Sync & Portability
 */

// ============================================================================
// Sync Targets
// ============================================================================

export type SyncTarget = 'memory' | 'policy' | 'settings' | 'all';

export type SyncDirection = 'push' | 'pull';

export type ConflictStrategy = 'last-write-wins' | 'manual' | 'merge';

// ============================================================================
// Sync Status
// ============================================================================

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline' | 'conflict';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: string;
  lastPushAt?: string;
  lastPullAt?: string;
  pendingChanges: number;
  conflicts: SyncConflict[];
  deviceId: string;
  deviceName: string;
  authenticated: boolean;
  autoSyncEnabled: boolean;
}

// ============================================================================
// Sync Conflict
// ============================================================================

export interface SyncConflict {
  id: string;
  target: SyncTarget;
  key: string;
  localValue: string;
  remoteValue: string;
  localModifiedAt: string;
  remoteModifiedAt: string;
  localHlc: string;
  remoteHlc: string;
  resolved: boolean;
  resolution?: 'local' | 'remote';
}

// ============================================================================
// Sync Metadata
// ============================================================================

export interface SyncMetadata {
  target: SyncTarget;
  key: string;
  lastModifiedAt: string;
  hlc: string;
  dirty: boolean;
  hash: string;
}

// ============================================================================
// Device
// ============================================================================

export interface Device {
  id: string;
  name: string;
  platform: string;
  lastSyncAt?: string;
  createdAt: string;
}

// ============================================================================
// Data Containers
// ============================================================================

export interface SyncPayload {
  deviceId: string;
  target: SyncTarget;
  data: Record<string, unknown>;
  metadata: SyncMetadata[];
  timestamp: string;
  version: string;
}

export interface SerializedData {
  target: SyncTarget;
  items: Array<{
    key: string;
    value: string;
    modifiedAt: string;
    hlc: string;
  }>;
  exportedAt: string;
}

// ============================================================================
// HLC (Hybrid Logical Clock)
// ============================================================================

export interface HLC {
  wallTime: number;
  counter: number;
  nodeId: string;
}

// ============================================================================
// Sync Configuration
// ============================================================================

export interface SyncConfig {
  autoSyncEnabled: boolean;
  autoSyncIntervalMs: number;
  conflictStrategy: ConflictStrategy;
  targets: SyncTarget[];
  encryptionEnabled: boolean;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSyncEnabled: false,
  autoSyncIntervalMs: 300000, // 5 minutes
  conflictStrategy: 'last-write-wins',
  targets: ['memory', 'policy', 'settings'],
  encryptionEnabled: true,
};
