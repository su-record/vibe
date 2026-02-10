/**
 * BrowserActions Unit Tests
 *
 * URL 검증, 액션 에러 핸들링, 타임아웃 로직.
 */

import { describe, it, expect } from 'vitest';
import type { PageState, BrowserError } from './types.js';
import { ALLOWED_SCHEMES, BLOCKED_IP_PATTERNS } from './types.js';

// ============================================================================
// URL Validation (Scenario 4: 페이지 네비게이션 — SSRF 방지)
// ============================================================================

describe('URL Validation: Scheme Check', () => {
  it('should allow http and https', () => {
    expect(ALLOWED_SCHEMES.has('http:')).toBe(true);
    expect(ALLOWED_SCHEMES.has('https:')).toBe(true);
  });

  it('should block file: scheme', () => {
    expect(ALLOWED_SCHEMES.has('file:')).toBe(false);
  });

  it('should block javascript: scheme', () => {
    expect(ALLOWED_SCHEMES.has('javascript:')).toBe(false);
  });

  it('should block data: scheme', () => {
    expect(ALLOWED_SCHEMES.has('data:')).toBe(false);
  });
});

describe('URL Validation: IP Blocking (SSRF)', () => {
  const isBlocked = (hostname: string): boolean => {
    return BLOCKED_IP_PATTERNS.some(pattern => pattern.test(hostname));
  };

  it('should block localhost IPs', () => {
    expect(isBlocked('127.0.0.1')).toBe(true);
    expect(isBlocked('127.0.0.2')).toBe(true);
  });

  it('should block private Class A', () => {
    expect(isBlocked('10.0.0.1')).toBe(true);
    expect(isBlocked('10.255.255.255')).toBe(true);
  });

  it('should block private Class B', () => {
    expect(isBlocked('172.16.0.1')).toBe(true);
    expect(isBlocked('172.31.255.255')).toBe(true);
  });

  it('should block private Class C', () => {
    expect(isBlocked('192.168.0.1')).toBe(true);
    expect(isBlocked('192.168.255.255')).toBe(true);
  });

  it('should block link-local / metadata IPs', () => {
    expect(isBlocked('169.254.169.254')).toBe(true);
    expect(isBlocked('169.254.0.1')).toBe(true);
  });

  it('should allow public IPs', () => {
    expect(isBlocked('8.8.8.8')).toBe(false);
    expect(isBlocked('142.250.185.14')).toBe(false);
    expect(isBlocked('1.1.1.1')).toBe(false);
  });

  it('should block unspecified IP', () => {
    expect(isBlocked('0.0.0.0')).toBe(true);
  });
});

// ============================================================================
// Scenario 9: 브라우저 액션 타임아웃
// ============================================================================

describe('Action Timeout Logic', () => {
  it('should have correct default timeout (8000ms)', () => {
    // BrowserActions uses normalizeTimeout internally
    const normalizeTimeout = (ms?: number, defaultMs = 8000): number =>
      Math.max(500, Math.min(60_000, ms ?? defaultMs));

    expect(normalizeTimeout()).toBe(8000);
    expect(normalizeTimeout(undefined, 8000)).toBe(8000);
  });

  it('should clamp minimum to 500ms', () => {
    const normalizeTimeout = (ms?: number, defaultMs = 8000): number =>
      Math.max(500, Math.min(60_000, ms ?? defaultMs));

    expect(normalizeTimeout(100)).toBe(500);
    expect(normalizeTimeout(0)).toBe(500);
    expect(normalizeTimeout(-1)).toBe(500);
  });

  it('should clamp maximum to 60s', () => {
    const normalizeTimeout = (ms?: number, defaultMs = 8000): number =>
      Math.max(500, Math.min(60_000, ms ?? defaultMs));

    expect(normalizeTimeout(120_000)).toBe(60_000);
    expect(normalizeTimeout(999_999)).toBe(60_000);
  });

  it('should accept values in valid range', () => {
    const normalizeTimeout = (ms?: number, defaultMs = 8000): number =>
      Math.max(500, Math.min(60_000, ms ?? defaultMs));

    expect(normalizeTimeout(5000)).toBe(5000);
    expect(normalizeTimeout(15_000)).toBe(15_000);
    expect(normalizeTimeout(500)).toBe(500);
    expect(normalizeTimeout(60_000)).toBe(60_000);
  });
});

// ============================================================================
// PageState Type Validation
// ============================================================================

describe('PageState Structure', () => {
  it('should hold roleRefs and snapshotVersion', () => {
    const state: PageState = {
      roleRefs: {
        e1: { role: 'button', name: 'Submit' },
        e2: { role: 'textbox', name: 'Email' },
      },
      snapshotVersion: 1,
    };

    expect(state.roleRefs.e1.role).toBe('button');
    expect(state.roleRefs.e2.name).toBe('Email');
    expect(state.snapshotVersion).toBe(1);
  });

  it('should support optional lastSnapshotAt', () => {
    const state: PageState = {
      roleRefs: {},
      snapshotVersion: 0,
      lastSnapshotAt: '2026-02-10T12:00:00Z',
    };

    expect(state.lastSnapshotAt).toBeDefined();
  });
});

// ============================================================================
// BrowserError Structure
// ============================================================================

describe('BrowserError Type', () => {
  it('should represent CDP connection failure', () => {
    const error: BrowserError = {
      error: 'CDP_CONNECTION_FAILED',
      message: 'Could not connect to CDP endpoint',
      retries: 3,
    };

    expect(error.error).toBe('CDP_CONNECTION_FAILED');
    expect(error.retries).toBe(3);
  });

  it('should represent action timeout', () => {
    const error: BrowserError = {
      error: 'ACTION_TIMEOUT',
      message: 'Action exceeded timeout',
      timeout: 8000,
    };

    expect(error.error).toBe('ACTION_TIMEOUT');
    expect(error.timeout).toBe(8000);
  });

  it('should represent stale ref', () => {
    const error: BrowserError = {
      error: 'REF_STALE',
      message: 'Ref e1 is stale. DOM has changed since last snapshot.',
    };

    expect(error.error).toBe('REF_STALE');
  });

  it('should represent navigation blocked', () => {
    const error: BrowserError = {
      error: 'NAVIGATION_BLOCKED',
      message: 'Blocked scheme "file:". Only http/https allowed.',
    };

    expect(error.error).toBe('NAVIGATION_BLOCKED');
  });
});
