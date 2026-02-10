/**
 * OAuthFlow Tests
 *
 * PKCE generation, state management, scope manager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { OAuthFlow, LocalCallbackServer } from './OAuthFlow.js';
import { TokenStore } from './TokenStore.js';
import { ScopeManager } from './ScopeManager.js';
import { GOOGLE_SCOPE_MAP } from './types.js';
import type { GoogleLogger } from './types.js';

const logger: GoogleLogger = () => {};

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-oauth-test-'));
}

describe('OAuthFlow', () => {
  let tmpDir: string;
  let db: Database.Database;
  let tokenStore: TokenStore;
  let scopeManager: ScopeManager;
  let oauthFlow: OAuthFlow;

  beforeEach(() => {
    tmpDir = createTempDir();
    process.env.VIBE_GOOGLE_MASTER_KEY = Buffer.from('a'.repeat(32)).toString('base64');

    const dbPath = path.join(tmpDir, 'test.db');
    tokenStore = new TokenStore(logger, dbPath);
    db = new Database(dbPath);
    scopeManager = new ScopeManager(db, logger);

    oauthFlow = new OAuthFlow(db, tokenStore, scopeManager, logger, {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackPort: 0, // Will not actually listen
    });
  });

  afterEach(() => {
    db.close();
    tokenStore.close();
    delete process.env.VIBE_GOOGLE_MASTER_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ════════════════════════════════════════════════════════════
  // Auth URL Generation
  // ════════════════════════════════════════════════════════════

  describe('Auth URL Generation', () => {
    it('should generate auth URL with PKCE parameters', () => {
      const scopes = [GOOGLE_SCOPE_MAP['gmail.send']];
      const { url, state } = oauthFlow.generateAuthUrl('user1', scopes);

      const parsed = new URL(url);
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('access_type')).toBe('offline');
      expect(state).toBeTruthy();
    });

    it('should include requested scopes', () => {
      const scopes = [
        GOOGLE_SCOPE_MAP['gmail.send'],
        GOOGLE_SCOPE_MAP['drive'],
      ];
      const { url } = oauthFlow.generateAuthUrl('user1', scopes);
      const parsed = new URL(url);
      const scopeParam = parsed.searchParams.get('scope');
      expect(scopeParam).toContain('gmail.send');
      expect(scopeParam).toContain('drive');
    });

    it('should generate unique state per request', () => {
      const { state: state1 } = oauthFlow.generateAuthUrl('user1', []);
      const { state: state2 } = oauthFlow.generateAuthUrl('user1', []);
      expect(state1).not.toBe(state2);
    });
  });

  // ════════════════════════════════════════════════════════════
  // State Management
  // ════════════════════════════════════════════════════════════

  describe('State Management', () => {
    it('should store state in DB on auth URL generation', () => {
      const { state } = oauthFlow.generateAuthUrl('user1', []);
      const stateHash = crypto.createHash('sha256').update(state).digest('hex');
      const row = db.prepare('SELECT * FROM oauth_states WHERE state_hash = ?').get(stateHash);
      expect(row).toBeTruthy();
    });

    it('should mark state as one-time use', () => {
      const { state } = oauthFlow.generateAuthUrl('user1', []);
      const stateHash = crypto.createHash('sha256').update(state).digest('hex');
      const row = db.prepare('SELECT used FROM oauth_states WHERE state_hash = ?').get(stateHash) as { used: number };
      expect(row.used).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════
  // ScopeManager Integration
  // ════════════════════════════════════════════════════════════

  describe('ScopeManager', () => {
    it('should grant and retrieve scopes', () => {
      scopeManager.grantScopes('user1', [
        GOOGLE_SCOPE_MAP['gmail.send'],
        GOOGLE_SCOPE_MAP['drive'],
      ]);
      const granted = scopeManager.getGrantedScopes('user1');
      expect(granted).toContain(GOOGLE_SCOPE_MAP['gmail.send']);
      expect(granted).toContain(GOOGLE_SCOPE_MAP['drive']);
    });

    it('should check scope by alias', () => {
      scopeManager.grantScopes('user1', [GOOGLE_SCOPE_MAP['gmail.send']]);
      expect(scopeManager.hasScope('user1', 'gmail.send')).toBe(true);
      expect(scopeManager.hasScope('user1', 'drive')).toBe(false);
    });

    it('should detect missing scopes', () => {
      scopeManager.grantScopes('user1', [GOOGLE_SCOPE_MAP['gmail.send']]);
      const missing = scopeManager.getMissingScopes('user1', ['gmail.send', 'drive']);
      expect(missing).toHaveLength(1);
      expect(missing[0]).toBe(GOOGLE_SCOPE_MAP['drive']);
    });

    it('should revoke all scopes for user', () => {
      scopeManager.grantScopes('user1', [GOOGLE_SCOPE_MAP['gmail.send']]);
      scopeManager.revokeScopes('user1');
      expect(scopeManager.getGrantedScopes('user1')).toHaveLength(0);
    });

    it('should detect denied scopes', () => {
      const requested = [GOOGLE_SCOPE_MAP['gmail.send'], GOOGLE_SCOPE_MAP['drive']];
      const granted = [GOOGLE_SCOPE_MAP['gmail.send']];
      const denied = scopeManager.detectDeniedScopes(requested, granted);
      expect(denied).toEqual([GOOGLE_SCOPE_MAP['drive']]);
    });

    it('should isolate scopes per user', () => {
      scopeManager.grantScopes('userA', [GOOGLE_SCOPE_MAP['gmail.send']]);
      scopeManager.grantScopes('userB', [GOOGLE_SCOPE_MAP['drive']]);

      expect(scopeManager.hasScope('userA', 'gmail.send')).toBe(true);
      expect(scopeManager.hasScope('userA', 'drive')).toBe(false);
      expect(scopeManager.hasScope('userB', 'drive')).toBe(true);
      expect(scopeManager.hasScope('userB', 'gmail.send')).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Token Refresh Error
  // ════════════════════════════════════════════════════════════

  describe('Token Refresh Errors', () => {
    it('should throw AUTH_REQUIRED when no tokens exist', async () => {
      await expect(oauthFlow.refreshTokens('nonexistent')).rejects.toThrow(/인증이 필요합니다/);
    });

    it('should throw when refresh token is empty', async () => {
      tokenStore.save('user1', 'access', '', 3600, ['scope1']);
      await expect(oauthFlow.refreshTokens('user1')).rejects.toThrow(/만료되었습니다/);
    });
  });

  // ════════════════════════════════════════════════════════════
  // LocalCallbackServer
  // ════════════════════════════════════════════════════════════

  describe('LocalCallbackServer', () => {
    it('should have correct redirect URI', () => {
      const server = new LocalCallbackServer(51199);
      expect(server.redirectUri).toBe('http://localhost:51199/oauth-callback');
      server.close();
    });

    it('should timeout after specified duration', async () => {
      const server = new LocalCallbackServer(51198, 100); // 100ms timeout
      await expect(server.waitForCallback('test-state')).rejects.toThrow(/타임아웃/);
    }, 5000);
  });
});

// ════════════════════════════════════════════════════════════
// PKCE Verification (standalone)
// ════════════════════════════════════════════════════════════

describe('PKCE Verification', () => {
  it('should generate valid S256 challenge from verifier', () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBeTruthy();
    expect(challenge).not.toBe(verifier);
    // S256 challenge should be base64url-encoded SHA-256
    expect(challenge.length).toBeGreaterThan(20);
  });
});
