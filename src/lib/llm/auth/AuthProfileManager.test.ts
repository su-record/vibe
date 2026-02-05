/**
 * AuthProfileManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AuthProfileManager } from './AuthProfileManager.js';
import { ProfileFileLock } from './ProfileFileLock.js';

const TEST_DIR = path.join(os.tmpdir(), `vibe-auth-test-${process.pid}`);
const TEST_PROFILES_PATH = path.join(TEST_DIR, 'auth-profiles.json');
const TEST_LOCK_PATH = path.join(TEST_DIR, '.auth-profiles.lock');

describe('AuthProfileManager', () => {
  let manager: AuthProfileManager;
  let lock: ProfileFileLock;

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    lock = new ProfileFileLock(TEST_LOCK_PATH);
    manager = new AuthProfileManager(TEST_PROFILES_PATH, lock);
  });

  afterEach(() => {
    try {
      if (lock.isLocked()) lock.release();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should add and list profiles', async () => {
    await manager.addProfile('gpt', 'apikey', 'sk-test1234567890', 1);
    await manager.addProfile('gpt', 'oauth', 'user@example.com', 2);

    const profiles = manager.listProfiles('gpt');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].identifier).toBe('***7890');
    expect(profiles[1].identifier).toBe('user@example.com');
  });

  it('should return active profile by priority', async () => {
    await manager.addProfile('gemini', 'apikey', 'key-high', 10);
    await manager.addProfile('gemini', 'apikey', 'key-low', 1);

    const active = manager.getActiveProfile('gemini');
    expect(active).not.toBeNull();
    expect(active!.priority).toBe(1);
  });

  it('should apply cooldown after 3 failures', async () => {
    const profile = await manager.addProfile('kimi', 'apikey', 'sk-test-key-1234', 1);

    await manager.markFailure(profile.id, 'rate limit 429');
    await manager.markFailure(profile.id, 'rate limit 429');
    await manager.markFailure(profile.id, 'rate limit 429');

    const profiles = manager.listProfiles('kimi');
    const updated = profiles.find(p => p.id === profile.id);
    expect(updated).toBeDefined();
    expect(updated!.errorCount).toBe(3);
    expect(updated!.cooldownUntil).toBeGreaterThan(Date.now());
  });

  it('should skip cooldown profiles in getActiveProfile', async () => {
    const p1 = await manager.addProfile('gpt', 'apikey', 'sk-key-one-1234', 1);
    await manager.addProfile('gpt', 'apikey', 'sk-key-two-5678', 2);

    // Put p1 into cooldown
    await manager.markFailure(p1.id);
    await manager.markFailure(p1.id);
    await manager.markFailure(p1.id);

    const active = manager.getActiveProfile('gpt');
    expect(active).not.toBeNull();
    expect(active!.id).not.toBe(p1.id);
  });

  it('should return soonest-expiring when all in cooldown', async () => {
    const p1 = await manager.addProfile('gpt', 'apikey', 'sk-key-one-1234', 1);
    const p2 = await manager.addProfile('gpt', 'apikey', 'sk-key-two-5678', 2);

    // Put both into cooldown
    for (let i = 0; i < 3; i++) {
      await manager.markFailure(p1.id);
      await manager.markFailure(p2.id);
    }

    // p2 has 1 more failure → longer cooldown
    await manager.markFailure(p2.id);

    const active = manager.getActiveProfile('gpt');
    expect(active).not.toBeNull();
    // p1 should have shorter cooldown
    expect(active!.id).toBe(p1.id);
  });

  it('should reset on markSuccess', async () => {
    const profile = await manager.addProfile('gemini', 'apikey', 'key-abcd1234', 1);
    await manager.markFailure(profile.id);
    await manager.markFailure(profile.id);
    await manager.markFailure(profile.id);

    await manager.markSuccess(profile.id);

    const profiles = manager.listProfiles('gemini');
    const updated = profiles.find(p => p.id === profile.id);
    expect(updated!.errorCount).toBe(0);
    expect(updated!.cooldownUntil).toBe(0);
  });

  it('should remove profiles', async () => {
    const profile = await manager.addProfile('kimi', 'apikey', 'key-1234', 1);
    expect(manager.listProfiles('kimi')).toHaveLength(1);

    const removed = await manager.removeProfile(profile.id);
    expect(removed).toBe(true);
    expect(manager.listProfiles('kimi')).toHaveLength(0);
  });

  it('should enforce max profiles per provider', async () => {
    // Add 10 profiles
    for (let i = 0; i < 10; i++) {
      await manager.addProfile('gpt', 'apikey', `sk-key-${i}-${String(i).padStart(4, '0')}`, i + 1);
    }
    expect(manager.listProfiles('gpt')).toHaveLength(10);

    // Adding 11th should evict oldest
    await manager.addProfile('gpt', 'apikey', 'sk-key-new-0011', 11);
    expect(manager.listProfiles('gpt')).toHaveLength(10);
  });

  it('should clear cooldowns', async () => {
    const profile = await manager.addProfile('gpt', 'apikey', 'sk-key-cd-1234', 1);
    await manager.markFailure(profile.id);
    await manager.markFailure(profile.id);
    await manager.markFailure(profile.id);

    await manager.clearCooldowns('gpt');

    const profiles = manager.listProfiles('gpt');
    expect(profiles[0].cooldownUntil).toBe(0);
    expect(profiles[0].errorCount).toBe(0);
  });

  it('should mask API keys in identifiers', async () => {
    const profile = await manager.addProfile('gpt', 'apikey', 'sk-1234567890abcdef', 1);
    expect(profile.identifier).toBe('***cdef');
    expect(profile.identifier).not.toContain('sk-');
  });
});

describe('ProfileFileLock', () => {
  let lockInstance: ProfileFileLock;
  const lockPath = path.join(TEST_DIR, '.test-lock');

  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    lockInstance = new ProfileFileLock(lockPath);
  });

  afterEach(() => {
    try {
      lockInstance.release();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should acquire and release lock', async () => {
    expect(lockInstance.isLocked()).toBe(false);
    await lockInstance.acquire();
    expect(lockInstance.isLocked()).toBe(true);
    lockInstance.release();
    expect(lockInstance.isLocked()).toBe(false);
  });

  it('should detect stale locks', async () => {
    // Create a stale lock manually (no PID)
    fs.mkdirSync(lockPath);
    // Backdate the mtime
    const pastTime = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, pastTime, pastTime);

    // Should be able to acquire (stale lock auto-cleanup)
    await lockInstance.acquire(5000);
    expect(lockInstance.isLocked()).toBe(true);
    lockInstance.release();
  });
});
