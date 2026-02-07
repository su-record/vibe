/**
 * GoogleAuthManager Tests
 * Token management, refresh, auth URL generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GoogleAuthManager } from './GoogleAuthManager.js';

const mockLogger = vi.fn();

// Mock env vars
const ORIGINAL_ENV = process.env;

describe('GoogleAuthManager', () => {
  let tokenDir: string;
  let tokenPath: string;

  beforeEach(() => {
    mockLogger.mockClear();
    tokenDir = path.join(os.tmpdir(), `vibe-test-${Date.now()}`);
    tokenPath = path.join(tokenDir, 'google-tokens.json');
    fs.mkdirSync(tokenDir, { recursive: true });

    process.env = {
      ...ORIGINAL_ENV,
      VIBE_SYNC_GOOGLE_CLIENT_ID: 'test-client-id',
      VIBE_SYNC_GOOGLE_CLIENT_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    try {
      if (fs.existsSync(tokenDir)) {
        fs.rmSync(tokenDir, { recursive: true, force: true });
      }
    } catch {
      // Windows file lock - ignore cleanup errors
    }
  });

  describe('Authentication state', () => {
    it('should not be authenticated without tokens', () => {
      const auth = new GoogleAuthManager(mockLogger, tokenPath);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should be authenticated with valid token file', () => {
      const tokens = {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expires: Date.now() + 3600_000,
        scopes: ['email'],
      };
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      const auth = new GoogleAuthManager(mockLogger, tokenPath);
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should not be authenticated without refresh token', () => {
      const tokens = {
        accessToken: 'test-access',
        refreshToken: '',
        expires: Date.now() + 3600_000,
        scopes: ['email'],
      };
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      const auth = new GoogleAuthManager(mockLogger, tokenPath);
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('Access token', () => {
    it('should return cached token when not expired', async () => {
      const tokens = {
        accessToken: 'valid-token',
        refreshToken: 'test-refresh',
        expires: Date.now() + 3600_000,
        scopes: ['email'],
      };
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      const auth = new GoogleAuthManager(mockLogger, tokenPath);
      const token = await auth.getAccessToken();
      expect(token).toBe('valid-token');
    });

    it('should throw when no tokens exist', async () => {
      const auth = new GoogleAuthManager(mockLogger, tokenPath);
      await expect(auth.getAccessToken()).rejects.toThrow('Google 인증이 필요합니다');
    });
  });

  describe('Auth URL generation', () => {
    it('should generate valid OAuth URL', () => {
      const auth = new GoogleAuthManager(mockLogger, tokenPath);
      const url = auth.getAuthUrl();

      expect(url).toContain('accounts.google.com');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('gmail.readonly');
      expect(url).toContain('calendar');
      expect(url).toContain('youtube.readonly');
      expect(url).toContain('access_type=offline');
    });
  });

  describe('fetchApi with 429 retry', () => {
    it('should succeed on first try when no 429', async () => {
      const tokens = {
        accessToken: 'valid-token',
        refreshToken: 'test-refresh',
        expires: Date.now() + 3600_000,
        scopes: ['email'],
      };
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      const auth = new GoogleAuthManager(mockLogger, tokenPath);

      // Mock fetch to succeed
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const res = await auth.fetchApi('https://api.example.com/test');
      expect(res.status).toBe(200);

      globalThis.fetch = originalFetch;
    });

    it('should retry on 429 and eventually throw', async () => {
      const tokens = {
        accessToken: 'valid-token',
        refreshToken: 'test-refresh',
        expires: Date.now() + 3600_000,
        scopes: ['email'],
      };
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      const auth = new GoogleAuthManager(mockLogger, tokenPath);

      const mock429 = new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '0' },
      });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mock429);

      await expect(auth.fetchApi('https://api.example.com/test')).rejects.toThrow('429');

      globalThis.fetch = originalFetch;
    }, 10000);
  });

  describe('Token exchange', () => {
    it('should save tokens after exchange', async () => {
      const auth = new GoogleAuthManager(mockLogger, tokenPath);

      const mockResponse = new Response(JSON.stringify({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      }), { status: 200 });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      await auth.exchangeCode('test-code');

      expect(auth.isAuthenticated()).toBe(true);
      const savedToken = await auth.getAccessToken();
      expect(savedToken).toBe('new-access');

      // Verify file was saved
      expect(fs.existsSync(tokenPath)).toBe(true);

      globalThis.fetch = originalFetch;
    });
  });
});
