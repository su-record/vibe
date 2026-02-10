/**
 * TokenStore Tests
 *
 * Envelope encryption, token family rotation, reuse detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { TokenStore } from './TokenStore.js';
import type { GoogleLogger } from './types.js';

const logger: GoogleLogger = () => {};

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-token-test-'));
}

describe('TokenStore', () => {
  let tmpDir: string;
  let store: TokenStore;

  beforeEach(() => {
    tmpDir = createTempDir();
    // KEK를 환경변수로 제공 (테스트 안정성)
    process.env.VIBE_GOOGLE_MASTER_KEY = Buffer.from(
      'a'.repeat(32),
    ).toString('base64');
    store = new TokenStore(logger, path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    store.close();
    delete process.env.VIBE_GOOGLE_MASTER_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ════════════════════════════════════════════════════════════
  // Encryption
  // ════════════════════════════════════════════════════════════

  describe('Envelope Encryption', () => {
    it('should save and load tokens with encryption', () => {
      store.save('user1', 'access_abc', 'refresh_xyz', 3600, ['scope1']);
      const loaded = store.load('user1');
      expect(loaded).not.toBeNull();
      expect(loaded!.accessToken).toBe('access_abc');
      expect(loaded!.refreshToken).toBe('refresh_xyz');
    });

    it('should encrypt tokens at rest (not plaintext in DB)', () => {
      store.save('user1', 'my_secret_token', 'my_refresh_token', 3600, ['scope1']);
      // Read raw DB file
      const dbContent = fs.readFileSync(path.join(tmpDir, 'test.db'));
      const text = dbContent.toString('utf-8');
      expect(text).not.toContain('my_secret_token');
      expect(text).not.toContain('my_refresh_token');
    });

    it('should return null for non-existent user', () => {
      const loaded = store.load('nonexistent');
      expect(loaded).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Token Family
  // ════════════════════════════════════════════════════════════

  describe('Token Family Rotation', () => {
    it('should create family on save', () => {
      store.save('user1', 'access', 'refresh', 3600, ['scope1']);
      const loaded = store.load('user1');
      expect(loaded).not.toBeNull();
      expect(loaded!.familyId).toBeTruthy();
      expect(loaded!.generation).toBe(1);
    });

    it('should increment generation on rotate', () => {
      store.save('user1', 'access1', 'refresh1', 3600, ['scope1']);
      const tokens = store.load('user1')!;
      store.rotateToken(
        'user1', tokens.familyId, tokens.generation,
        'access2', 'refresh2', 3600, ['scope1'],
      );
      const rotated = store.load('user1');
      expect(rotated!.generation).toBe(2);
      expect(rotated!.accessToken).toBe('access2');
    });

    it('should detect reuse and invalidate family', () => {
      store.save('user1', 'access1', 'refresh1', 3600, ['scope1']);
      const tokens = store.load('user1')!;

      // First rotate (gen 1 → 2)
      store.rotateToken(
        'user1', tokens.familyId, 1,
        'access2', 'refresh2', 3600, ['scope1'],
      );

      // Attempt reuse with old generation (gen 1 again)
      expect(() => {
        store.rotateToken(
          'user1', tokens.familyId, 1,
          'access3', 'refresh3', 3600, ['scope1'],
        );
      }).toThrow(/reuse detected/i);

      // Tokens should be gone (family compromised)
      const loaded = store.load('user1');
      expect(loaded).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Revoke
  // ════════════════════════════════════════════════════════════

  describe('Token Revocation', () => {
    it('should delete all tokens for user', () => {
      store.save('user1', 'access', 'refresh', 3600, ['scope1']);
      expect(store.load('user1')).not.toBeNull();
      store.revoke('user1');
      expect(store.load('user1')).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Expiry
  // ════════════════════════════════════════════════════════════

  describe('Token Expiry', () => {
    it('should detect expired tokens', () => {
      store.save('user1', 'access', 'refresh', 1, ['scope1']); // 1 second
      const loaded = store.load('user1')!;
      // Token expires in 1 second, margin is 60s → should be expired
      expect(store.isExpired(loaded, 60_000)).toBe(true);
    });

    it('should not flag valid tokens as expired', () => {
      store.save('user1', 'access', 'refresh', 7200, ['scope1']); // 2 hours
      const loaded = store.load('user1')!;
      expect(store.isExpired(loaded, 60_000)).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Multi-user Isolation
  // ════════════════════════════════════════════════════════════

  describe('Multi-user Isolation', () => {
    it('should isolate tokens per user', () => {
      store.save('userA', 'accessA', 'refreshA', 3600, ['scope1']);
      store.save('userB', 'accessB', 'refreshB', 3600, ['scope2']);

      const tokensA = store.load('userA')!;
      const tokensB = store.load('userB')!;

      expect(tokensA.accessToken).toBe('accessA');
      expect(tokensB.accessToken).toBe('accessB');
    });

    it('should not leak tokens between users on revoke', () => {
      store.save('userA', 'accessA', 'refreshA', 3600, ['scope1']);
      store.save('userB', 'accessB', 'refreshB', 3600, ['scope2']);

      store.revoke('userA');
      expect(store.load('userA')).toBeNull();
      expect(store.load('userB')).not.toBeNull();
    });
  });
});
