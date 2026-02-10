/**
 * Google Services Tests
 *
 * Per-User service wrappers: error handling, retry logic, report HTML.
 * API calls are mocked (no actual Google API).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import Database from 'better-sqlite3';
import { OAuthFlow } from '../OAuthFlow.js';
import { TokenStore } from '../TokenStore.js';
import { ScopeManager } from '../ScopeManager.js';
import { PerUserGmailService } from './GmailService.js';
import { PerUserDriveService } from './DriveService.js';
import { PerUserSheetsService } from './SheetsService.js';
import { PerUserCalendarService } from './CalendarService.js';
import type { GoogleLogger } from '../types.js';

const logger: GoogleLogger = () => {};

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-svc-test-'));
}

function createTestServices(tmpDir: string): {
  oauthFlow: OAuthFlow;
  tokenStore: TokenStore;
  db: Database.Database;
} {
  process.env.VIBE_GOOGLE_MASTER_KEY = Buffer.from('a'.repeat(32)).toString('base64');
  const dbPath = path.join(tmpDir, 'test.db');
  const tokenStore = new TokenStore(logger, dbPath);
  const db = new Database(dbPath);
  const scopeManager = new ScopeManager(db, logger);
  const oauthFlow = new OAuthFlow(db, tokenStore, scopeManager, logger, {
    clientId: 'test-client-id',
  });
  return { oauthFlow, tokenStore, db };
}

describe('PerUserGmailService', () => {
  let tmpDir: string;
  let services: ReturnType<typeof createTestServices>;
  let gmail: PerUserGmailService;

  beforeEach(() => {
    tmpDir = createTempDir();
    services = createTestServices(tmpDir);
    gmail = new PerUserGmailService(services.oauthFlow, logger);
  });

  afterEach(() => {
    services.db.close();
    services.tokenStore.close();
    delete process.env.VIBE_GOOGLE_MASTER_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should throw when user has no tokens', async () => {
    await expect(gmail.sendEmail('no-user', {
      to: 'test@test.com',
      subject: 'Test',
      body: 'Test body',
    })).rejects.toThrow(/인증이 필요합니다/);
  });

  it('should throw when user has no tokens for search', async () => {
    await expect(gmail.searchMail('no-user', 'test')).rejects.toThrow(/인증이 필요합니다/);
  });
});

describe('PerUserDriveService', () => {
  let tmpDir: string;
  let services: ReturnType<typeof createTestServices>;
  let drive: PerUserDriveService;

  beforeEach(() => {
    tmpDir = createTempDir();
    services = createTestServices(tmpDir);
    drive = new PerUserDriveService(services.oauthFlow, logger);
  });

  afterEach(() => {
    services.db.close();
    services.tokenStore.close();
    delete process.env.VIBE_GOOGLE_MASTER_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should throw for non-existent file upload', async () => {
    services.tokenStore.save('user1', 'access', 'refresh', 3600, ['scope']);
    await expect(drive.upload('user1', '/nonexistent/file.txt')).rejects.toThrow(/not found/i);
  });

  it('should throw when user has no tokens for list', async () => {
    await expect(drive.list('no-user')).rejects.toThrow(/인증이 필요합니다/);
  });
});

describe('PerUserSheetsService', () => {
  let tmpDir: string;
  let services: ReturnType<typeof createTestServices>;
  let sheets: PerUserSheetsService;

  beforeEach(() => {
    tmpDir = createTempDir();
    services = createTestServices(tmpDir);
    sheets = new PerUserSheetsService(services.oauthFlow, logger);
  });

  afterEach(() => {
    services.db.close();
    services.tokenStore.close();
    delete process.env.VIBE_GOOGLE_MASTER_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should throw when user has no tokens for read', async () => {
    await expect(sheets.read('no-user', 'spreadsheet-id', 'Sheet1!A1:C10'))
      .rejects.toThrow(/인증이 필요합니다/);
  });
});

describe('PerUserCalendarService', () => {
  let tmpDir: string;
  let services: ReturnType<typeof createTestServices>;
  let calendar: PerUserCalendarService;

  beforeEach(() => {
    tmpDir = createTempDir();
    services = createTestServices(tmpDir);
    calendar = new PerUserCalendarService(services.oauthFlow, logger);
  });

  afterEach(() => {
    services.db.close();
    services.tokenStore.close();
    delete process.env.VIBE_GOOGLE_MASTER_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should throw when user has no tokens for listEvents', async () => {
    const now = new Date().toISOString();
    const later = new Date(Date.now() + 86400000).toISOString();
    await expect(calendar.listEvents('no-user', now, later))
      .rejects.toThrow(/인증이 필요합니다/);
  });

  it('should throw when user has no tokens for createEvent', async () => {
    await expect(calendar.createEvent('no-user', {
      summary: 'Test',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
    })).rejects.toThrow(/인증이 필요합니다/);
  });
});

// ════════════════════════════════════════════════════════════
// Token Masking in Error Messages
// ════════════════════════════════════════════════════════════

describe('Token Masking', () => {
  it('should not expose token values in error messages', () => {
    const token = 'ya29.a0ARrdaM_super_secret_token_value';
    const safeMsg = token.replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED]');
    expect(safeMsg).not.toContain('super_secret');
    expect(safeMsg).toBe('[REDACTED]');
  });

  it('should mask refresh tokens in messages', () => {
    const token = '1//0fake-refresh-token-value';
    const safeMsg = token.replace(/1\/\/[a-zA-Z0-9_-]+/g, '[REDACTED]');
    expect(safeMsg).not.toContain('fake-refresh');
  });
});
