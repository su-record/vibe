/**
 * Google Types & Utility Tests
 *
 * Scope mapping, error creation, config defaults.
 * (No SQLite dependency — always runnable)
 */

import { describe, it, expect } from 'vitest';
import {
  GOOGLE_SCOPE_MAP,
  createGoogleError,
  DEFAULT_GOOGLE_CONFIG,
} from './types.js';

describe('GOOGLE_SCOPE_MAP', () => {
  it('should map gmail.send to full URL', () => {
    expect(GOOGLE_SCOPE_MAP['gmail.send']).toBe(
      'https://www.googleapis.com/auth/gmail.send',
    );
  });

  it('should map drive to full URL', () => {
    expect(GOOGLE_SCOPE_MAP['drive']).toBe(
      'https://www.googleapis.com/auth/drive',
    );
  });

  it('should map calendar to full URL', () => {
    expect(GOOGLE_SCOPE_MAP['calendar']).toBe(
      'https://www.googleapis.com/auth/calendar',
    );
  });

  it('should map spreadsheets to full URL', () => {
    expect(GOOGLE_SCOPE_MAP['spreadsheets']).toBe(
      'https://www.googleapis.com/auth/spreadsheets',
    );
  });

  it('should have all expected aliases', () => {
    const aliases = Object.keys(GOOGLE_SCOPE_MAP);
    expect(aliases).toContain('gmail.readonly');
    expect(aliases).toContain('gmail.send');
    expect(aliases).toContain('drive');
    expect(aliases).toContain('drive.file');
    expect(aliases).toContain('spreadsheets');
    expect(aliases).toContain('calendar');
    expect(aliases).toContain('calendar.events');
    expect(aliases).toContain('youtube.readonly');
    expect(aliases).toContain('userinfo.email');
  });
});

describe('createGoogleError', () => {
  it('should create error with code and message', () => {
    const err = createGoogleError('AUTH_REQUIRED', 'Need auth');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.message).toBe('Need auth');
  });

  it('should include retries if provided', () => {
    const err = createGoogleError('API_ERROR', 'Failed', { retries: 3 });
    expect(err.retries).toBe(3);
  });

  it('should include details if provided', () => {
    const details = { statusCode: 429 };
    const err = createGoogleError('RATE_LIMITED', 'Too many', { details });
    expect(err.details).toEqual(details);
  });

  it('should not include undefined extras', () => {
    const err = createGoogleError('UNKNOWN_ERROR', 'Unknown');
    expect(err.retries).toBeUndefined();
    expect(err.details).toBeUndefined();
  });
});

describe('DEFAULT_GOOGLE_CONFIG', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_GOOGLE_CONFIG.apiTimeout).toBe(10_000);
    expect(DEFAULT_GOOGLE_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_GOOGLE_CONFIG.refreshMarginMs).toBe(60_000);
  });
});

describe('Token Masking Patterns', () => {
  it('should mask Google access tokens', () => {
    const token = 'ya29.a0ARrdaM_xxxxxxxxxxxxxxxxxxxxx';
    const masked = token.replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED]');
    expect(masked).toBe('[REDACTED]');
  });

  it('should mask Google refresh tokens', () => {
    const token = '1//0fake-refresh-token-value';
    const masked = token.replace(/1\/\/[a-zA-Z0-9_-]+/g, '[REDACTED]');
    expect(masked).not.toContain('fake-refresh');
    expect(masked).toBe('[REDACTED]');
  });

  it('should not mask normal text', () => {
    const text = 'This is a normal error message';
    const masked = text.replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED]');
    expect(masked).toBe(text);
  });
});

describe('PKCE Generation (standalone)', () => {
  it('should generate valid S256 challenge', async () => {
    const crypto = await import('node:crypto');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    expect(verifier.length).toBeGreaterThan(20);
    expect(challenge.length).toBeGreaterThan(20);
    expect(challenge).not.toBe(verifier);
  });

  it('should produce deterministic challenge for same verifier', async () => {
    const crypto = await import('node:crypto');
    const verifier = 'test-verifier-value';
    const challenge1 = crypto.createHash('sha256').update(verifier).digest('base64url');
    const challenge2 = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge1).toBe(challenge2);
  });
});

describe('Envelope Encryption Concepts', () => {
  it('should encrypt and decrypt with AES-256-GCM', async () => {
    const crypto = await import('node:crypto');
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const plaintext = 'my_secret_token_value';

    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');

    expect(decrypted).toBe(plaintext);
    expect(encrypted.toString('utf8')).not.toBe(plaintext);
  });

  it('should fail decryption with wrong key', async () => {
    const crypto = await import('node:crypto');
    const key1 = crypto.randomBytes(32);
    const key2 = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key1, iv);
    const encrypted = Buffer.concat([cipher.update('secret', 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key2, iv);
    decipher.setAuthTag(authTag);
    expect(() => {
      Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }).toThrow();
  });
});
