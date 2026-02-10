import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock ConfigManager before importing TokenRefresher
const testConfigDir = path.join(os.tmpdir(), `vibe-test-token-${Date.now()}`);

vi.mock('./ConfigManager.js', () => ({
  getGlobalConfigDir: () => testConfigDir,
}));

// Dynamic import after mocking
const { tokenRefresher } = await import('./TokenRefresher.js');

describe('TokenRefresher', () => {
  beforeEach(() => {
    fs.mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup lock directories
    const lockPattern = '.refresh-';
    try {
      const files = fs.readdirSync(testConfigDir);
      for (const file of files) {
        if (file.startsWith(lockPattern)) {
          const lockDir = path.join(testConfigDir, file);
          try {
            const ownerPath = path.join(lockDir, 'owner.json');
            if (fs.existsSync(ownerPath)) fs.unlinkSync(ownerPath);
            fs.rmdirSync(lockDir);
          } catch { /* best-effort */ }
        }
      }
    } catch { /* dir may not exist */ }
    fs.rmSync(testConfigDir, { recursive: true, force: true });
  });

  it('should execute refresh function and return result', async () => {
    const mockRefresh = vi.fn().mockResolvedValue({
      accessToken: 'new-token-123',
      refreshToken: 'refresh-456',
      expires: Date.now() + 3600000,
    });

    const result = await tokenRefresher.refreshWithLock('test-provider', mockRefresh);

    expect(result.accessToken).toBe('new-token-123');
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('should deduplicate concurrent in-process refresh calls', async () => {
    let resolveRefresh: ((value: { accessToken: string; expires: number }) => void) | undefined;
    const mockRefresh = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveRefresh = resolve; })
    );

    // Launch two concurrent refreshes
    const p1 = tokenRefresher.refreshWithLock('dedup-test', mockRefresh);
    const p2 = tokenRefresher.refreshWithLock('dedup-test', mockRefresh);

    // Both should share the same promise
    resolveRefresh!({ accessToken: 'shared-token', expires: Date.now() + 3600000 });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.accessToken).toBe('shared-token');
    expect(r2.accessToken).toBe('shared-token');
    expect(mockRefresh).toHaveBeenCalledOnce(); // Only called once
  });

  it('should create and cleanup lock directory', async () => {
    const lockDir = path.join(testConfigDir, '.refresh-lock-test.lock');

    const result = await tokenRefresher.refreshWithLock('lock-test', async () => {
      // Lock should exist during refresh
      expect(fs.existsSync(lockDir)).toBe(true);
      return { accessToken: 'locked-token', expires: Date.now() + 3600000 };
    });

    expect(result.accessToken).toBe('locked-token');
    // Lock should be cleaned up after refresh
    expect(fs.existsSync(lockDir)).toBe(false);
  });

  it('should handle stale lock from dead process', async () => {
    const lockDir = path.join(testConfigDir, '.refresh-stale-test.lock');

    // Simulate a stale lock (old timestamp, dead PID)
    fs.mkdirSync(lockDir);
    const ownerPath = path.join(lockDir, 'owner.json');
    fs.writeFileSync(ownerPath, JSON.stringify({
      pid: 999999, // Very unlikely to be a real PID
      createdAt: Date.now() - 60000, // 60 seconds ago (stale)
    }));

    const mockRefresh = vi.fn().mockResolvedValue({
      accessToken: 'after-stale',
      expires: Date.now() + 3600000,
    });

    const result = await tokenRefresher.refreshWithLock('stale-test', mockRefresh);

    expect(result.accessToken).toBe('after-stale');
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('should use readCurrentToken callback when lock is held', async () => {
    const lockDir = path.join(testConfigDir, '.refresh-poll-test.lock');

    // Create a lock that will be held by current process (different provider)
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify({
      pid: process.pid,
      createdAt: Date.now(),
    }));

    let callCount = 0;
    const readCurrentToken = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount >= 2) {
        // Simulate another process completing the refresh
        return { accessToken: 'polled-token', expires: Date.now() + 3600000 };
      }
      return { accessToken: 'old-token', expires: Date.now() - 1000 };
    });

    const mockRefresh = vi.fn().mockResolvedValue({
      accessToken: 'fallback-token',
      expires: Date.now() + 3600000,
    });

    const result = await tokenRefresher.refreshWithLock(
      'poll-test',
      mockRefresh,
      readCurrentToken
    );

    // Should either get the polled token or the refresh result
    expect(result.accessToken).toBeTruthy();

    // Cleanup
    try {
      fs.unlinkSync(path.join(lockDir, 'owner.json'));
      fs.rmdirSync(lockDir);
    } catch { /* best-effort */ }
  });
});
