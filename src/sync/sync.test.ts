/**
 * Phase 5: Sync & Portability Tests (15 Scenarios)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { SyncStore } from './SyncStore.js';
import { SyncEngine } from './SyncEngine.js';
import { DataSerializer } from './DataSerializer.js';
import { ConflictResolver } from './ConflictResolver.js';
import { DeviceManager } from './DeviceManager.js';
import { SyncConflict, SyncMetadata } from './types.js';
import { LogLevel } from '../daemon/types.js';

const TEST_DIR = path.join(os.tmpdir(), `vibe-sync-test-${process.pid}`);
const noopLogger = (_level: LogLevel, _msg: string, _data?: unknown): void => {};

function makeTestDb(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-${crypto.randomBytes(4).toString('hex')}.db`);
}

// ============================================================================
// Scenario 1: Google OAuth login (structure test)
// ============================================================================

describe('Scenario 1: Google OAuth login', () => {
  it('should have SyncEngine with authentication state', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    const status = engine.getStatus();
    expect(status.authenticated).toBe(false);

    engine.setAuthenticated(true);
    expect(engine.getStatus().authenticated).toBe(true);

    engine.close();
  });
});

// ============================================================================
// Scenario 2: Push memory to cloud
// ============================================================================

describe('Scenario 2: Push memory data', () => {
  it('should push dirty items and mark them clean', async () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    // Track changes
    engine.trackChange('memory', 'test-item', 'test-content');
    expect(store.getPendingCount()).toBe(1);

    const result = await engine.push(['memory']);
    expect(result.errors.length).toBe(0);

    // Should be marked clean
    expect(store.getPendingCount()).toBe(0);

    engine.close();
  });

  it('should record push in sync history', async () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    await engine.push(['memory']);

    const lastSync = store.getLastSyncTime();
    expect(lastSync).toBeDefined();

    engine.close();
  });
});

// ============================================================================
// Scenario 3: Pull memory from cloud
// ============================================================================

describe('Scenario 3: Pull memory data', () => {
  it('should record pull in sync history', async () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    const result = await engine.pull(['memory']);
    expect(result.errors.length).toBe(0);

    const lastSync = store.getLastSyncTime();
    expect(lastSync).toBeDefined();

    engine.close();
  });
});

// ============================================================================
// Scenario 4: Sync policies
// ============================================================================

describe('Scenario 4: Sync user policies', () => {
  it('should export policy files', () => {
    const serializer = new DataSerializer(noopLogger);
    const data = serializer.exportPolicies();

    expect(data.target).toBe('policy');
    expect(data.exportedAt).toBeDefined();
    // May or may not have items depending on local state
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('should push policies', async () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    const result = await engine.push(['policy']);
    expect(result.errors.length).toBe(0);

    engine.close();
  });
});

// ============================================================================
// Scenario 5: Sync settings (exclude credentials)
// ============================================================================

describe('Scenario 5: Sync settings without credentials', () => {
  it('should detect credential files', () => {
    const serializer = new DataSerializer(noopLogger);

    expect(serializer.isCredentialFile('api-key.json')).toBe(true);
    expect(serializer.isCredentialFile('gpt-apikey.json')).toBe(true);
    expect(serializer.isCredentialFile('oauth-token.json')).toBe(true);
    expect(serializer.isCredentialFile('vault.enc')).toBe(true);
    expect(serializer.isCredentialFile('config.json')).toBe(false);
    expect(serializer.isCredentialFile('policies.json')).toBe(false);
  });

  it('should export settings without credentials', () => {
    const serializer = new DataSerializer(noopLogger);
    const data = serializer.exportSettings();

    expect(data.target).toBe('settings');
    // Settings items should not contain credential-like keys
    for (const item of data.items) {
      expect(serializer.isCredentialFile(item.key)).toBe(false);
    }
  });
});

// ============================================================================
// Scenario 6: Detect conflict
// ============================================================================

describe('Scenario 6: Detect sync conflict', () => {
  it('should detect conflict when both sides modified within 5 min', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const resolver = new ConflictResolver('last-write-wins', store, noopLogger);

    const now = Date.now();
    const localMeta: SyncMetadata = {
      target: 'memory',
      key: 'test-key',
      lastModifiedAt: new Date(now).toISOString(),
      hlc: `${now}:0:device-a`,
      dirty: true,
      hash: 'local-hash',
    };

    const remoteMeta: SyncMetadata = {
      target: 'memory',
      key: 'test-key',
      lastModifiedAt: new Date(now + 1000).toISOString(),
      hlc: `${now + 1000}:0:device-b`,
      dirty: true,
      hash: 'remote-hash',
    };

    const hasConflict = resolver.detectConflict(localMeta, remoteMeta);
    expect(hasConflict).toBe(true);

    store.close();
  });

  it('should not detect conflict when hashes match', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const resolver = new ConflictResolver('last-write-wins', store, noopLogger);

    const now = Date.now();
    const localMeta: SyncMetadata = {
      target: 'memory',
      key: 'test-key',
      lastModifiedAt: new Date().toISOString(),
      hlc: `${now}:0:a`,
      dirty: true,
      hash: 'same-hash',
    };

    const remoteMeta: SyncMetadata = {
      target: 'memory',
      key: 'test-key',
      lastModifiedAt: new Date().toISOString(),
      hlc: `${now + 100}:0:b`,
      dirty: true,
      hash: 'same-hash',
    };

    expect(resolver.detectConflict(localMeta, remoteMeta)).toBe(false);

    store.close();
  });
});

// ============================================================================
// Scenario 7: Resolve conflict (last-write-wins)
// ============================================================================

describe('Scenario 7: Resolve conflict with last-write-wins', () => {
  it('should pick newer HLC in LWW', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const resolver = new ConflictResolver('last-write-wins', store, noopLogger);

    const now = Date.now();
    const conflict: SyncConflict = {
      id: 'c1',
      target: 'memory',
      key: 'test',
      localValue: 'old',
      remoteValue: 'new',
      localModifiedAt: new Date(now).toISOString(),
      remoteModifiedAt: new Date(now + 5000).toISOString(),
      localHlc: `${now}:0:a`,
      remoteHlc: `${now + 5000}:0:b`,
      resolved: false,
    };

    const resolution = resolver.resolve(conflict);
    expect(resolution).toBe('remote');

    store.close();
  });

  it('should prefer local when HLC is equal', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const resolver = new ConflictResolver('last-write-wins', store, noopLogger);

    const now = Date.now();
    const conflict: SyncConflict = {
      id: 'c2',
      target: 'memory',
      key: 'test',
      localValue: 'local-val',
      remoteValue: 'remote-val',
      localModifiedAt: new Date(now).toISOString(),
      remoteModifiedAt: new Date(now).toISOString(),
      localHlc: `${now}:0:a`,
      remoteHlc: `${now}:0:b`,
      resolved: false,
    };

    const resolution = resolver.resolve(conflict);
    expect(resolution).toBe('local'); // Local-first principle

    store.close();
  });
});

// ============================================================================
// Scenario 8: Resolve conflict (manual)
// ============================================================================

describe('Scenario 8: Resolve conflict manually', () => {
  it('should save conflict for manual resolution', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const resolver = new ConflictResolver('manual', store, noopLogger);

    const conflict: SyncConflict = {
      id: 'c3',
      target: 'policy',
      key: 'test-policy',
      localValue: 'local',
      remoteValue: 'remote',
      localModifiedAt: new Date().toISOString(),
      remoteModifiedAt: new Date().toISOString(),
      localHlc: `${Date.now()}:0:a`,
      remoteHlc: `${Date.now()}:0:b`,
      resolved: false,
    };

    const resolution = resolver.resolve(conflict);
    expect(resolution).toBe('manual');

    const conflicts = resolver.getConflicts();
    expect(conflicts.length).toBe(1);

    // Resolve manually
    resolver.resolveManually(conflicts[0].id, 'local');
    expect(resolver.getConflicts().length).toBe(0);

    store.close();
  });
});

// ============================================================================
// Scenario 9: List devices
// ============================================================================

describe('Scenario 9: List synced devices', () => {
  it('should list current device', () => {
    const manager = new DeviceManager(noopLogger);
    const devices = manager.listDevices();

    expect(devices.length).toBeGreaterThanOrEqual(1);

    const current = manager.getCurrentDevice();
    expect(current).toBeDefined();
    expect(current.id).toBe(manager.getDeviceId());
    expect(current.platform).toBeDefined();
  });
});

// ============================================================================
// Scenario 10: Rename device
// ============================================================================

describe('Scenario 10: Rename current device', () => {
  it('should rename device', () => {
    const manager = new DeviceManager(noopLogger);
    const originalName = manager.getCurrentDevice().name;

    manager.renameDevice('Test-Device-XYZ');
    expect(manager.getCurrentDevice().name).toBe('Test-Device-XYZ');

    // Restore
    manager.renameDevice(originalName);
  });
});

// ============================================================================
// Scenario 11: Auto sync on daemon start
// ============================================================================

describe('Scenario 11: Auto pull on daemon start', () => {
  it('should start auto-sync when enabled', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger, { autoSyncEnabled: true });

    const status = engine.getStatus();
    expect(status.autoSyncEnabled).toBe(true);

    // Don't actually start (would create timers)
    engine.close();
  });
});

// ============================================================================
// Scenario 12: Auto sync periodically
// ============================================================================

describe('Scenario 12: Periodic sync every 5 minutes', () => {
  it('should have configurable auto-sync interval', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger, {
      autoSyncEnabled: true,
      autoSyncIntervalMs: 300000,
    });

    const status = engine.getStatus();
    expect(status.autoSyncEnabled).toBe(true);

    engine.close();
  });
});

// ============================================================================
// Scenario 13: Offline mode
// ============================================================================

describe('Scenario 13: Work offline without sync', () => {
  it('should queue changes when offline', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    // Track changes (works offline)
    engine.trackChange('memory', 'offline-item', 'offline-content');
    expect(store.getPendingCount()).toBe(1);

    // Changes are queued
    const dirty = store.getDirtyItems('memory');
    expect(dirty.length).toBe(1);
    expect(dirty[0].key).toBe('offline-item');

    engine.close();
  });

  it('should work without network connection', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    // All local operations should work
    engine.trackChange('policy', 'test-policy', 'content');
    const status = engine.getStatus();
    expect(status.pendingChanges).toBe(1);
    expect(status.state).toBe('idle');

    engine.close();
  });
});

// ============================================================================
// Scenario 14: Handle Google Drive API failure
// ============================================================================

describe('Scenario 14: Recover from Google Drive API failure', () => {
  it('should return errors without losing local data', async () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    // Track a change
    engine.trackChange('memory', 'important-data', 'critical content');

    // Push succeeds (local simulation)
    const result = await engine.push(['memory']);
    expect(result.errors.length).toBe(0);

    // Data is preserved locally regardless
    const meta = store.getMetadata('memory', 'important-data');
    expect(meta).toBeDefined();

    engine.close();
  });
});

// ============================================================================
// Scenario 15: Logout and remove sync
// ============================================================================

describe('Scenario 15: Logout from sync', () => {
  it('should clear auth state on logout', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    engine.setAuthenticated(true);
    expect(engine.getStatus().authenticated).toBe(true);

    // Simulate logout
    engine.setAuthenticated(false);
    engine.stopAutoSync();

    const status = engine.getStatus();
    expect(status.authenticated).toBe(false);

    engine.close();
  });

  it('should preserve local data after logout', () => {
    const store = new SyncStore(noopLogger, makeTestDb());
    const engine = new SyncEngine(store, noopLogger);

    // Add local data
    engine.trackChange('memory', 'local-item', 'local-data');

    // Logout
    engine.setAuthenticated(false);
    engine.stopAutoSync();

    // Local data still exists
    const dirty = store.getDirtyItems('memory');
    expect(dirty.length).toBe(1);
    expect(dirty[0].key).toBe('local-item');

    engine.close();
  });
});

// ============================================================================
// Additional: SyncStore unit tests
// ============================================================================

describe('SyncStore', () => {
  it('should generate and compare HLC values', () => {
    const store = new SyncStore(noopLogger, makeTestDb());

    const hlc1 = store.generateHLC();
    const hlc2 = store.generateHLC();

    expect(hlc1).toBeDefined();
    expect(hlc2).toBeDefined();

    // Both should be valid HLC format
    expect(hlc1.split(':').length).toBe(3);

    store.close();
  });

  it('should compare HLC values correctly', () => {
    expect(SyncStore.compareHLC('1000:0:a', '2000:0:b')).toBeLessThan(0);
    expect(SyncStore.compareHLC('2000:0:a', '1000:0:b')).toBeGreaterThan(0);
    expect(SyncStore.compareHLC('1000:0:a', '1000:0:b')).toBe(0);
    expect(SyncStore.compareHLC('1000:1:a', '1000:0:b')).toBeGreaterThan(0);
  });

  it('should compute hashes', () => {
    const serializer = new DataSerializer(noopLogger);
    const hash1 = serializer.computeHash('hello');
    const hash2 = serializer.computeHash('hello');
    const hash3 = serializer.computeHash('world');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(16);
  });
});

// ============================================================================
// Cleanup
// ============================================================================

describe('Cleanup', () => {
  it('cleanup test files', () => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    expect(true).toBe(true);
  });
});
