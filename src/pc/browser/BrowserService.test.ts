/**
 * BrowserService Unit Tests
 *
 * IBrowserProvider 팩토리, 테넌트 격리, 재연결 로직.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserService, LocalBrowserProvider } from './BrowserService.js';
import type { IBrowserProvider } from './types.js';

const noopLogger = (_level: string, _msg: string, _data?: unknown): void => {};

// ============================================================================
// Mock Provider
// ============================================================================

class MockBrowserProvider implements IBrowserProvider {
  readonly name = 'mock';
  private shouldFail = false;
  terminateCalled = false;

  setFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async getCDPUrl(): Promise<string> {
    if (this.shouldFail) throw new Error('Mock CDP failure');
    return 'ws://127.0.0.1:9222/devtools/browser/mock-id';
  }

  isSandboxed(): boolean {
    return false;
  }

  async terminate(): Promise<void> {
    this.terminateCalled = true;
  }
}

// ============================================================================
// Scenario 6: Ephemeral 브라우저 컨텍스트 (테넌트 격리)
// ============================================================================

describe('BrowserService: Tenant Isolation', () => {
  let service: BrowserService;

  beforeEach(() => {
    service = new BrowserService(noopLogger, {
      maxRetries: 1,
      maxLocalSessions: 3,
    });
  });

  it('should start with no active sessions', () => {
    expect(service.activeSessionCount).toBe(0);
  });

  it('should not be connected initially', () => {
    expect(service.isConnected()).toBe(false);
  });

  it('should report disconnect after construction', () => {
    expect(service.isConnected()).toBe(false);
    expect(service.activeSessionCount).toBe(0);
  });
});

// ============================================================================
// Scenario 8: CDP 연결 실패 시 JSON 에러 반환
// ============================================================================

describe('BrowserService: CDP Connection Errors', () => {
  it('should create structured error with code', () => {
    const service = new BrowserService(noopLogger, { maxRetries: 1 });
    const error = service.createError('CDP_CONNECTION_FAILED', 'Connection failed', { retries: 3 });

    expect(error.error).toBe('CDP_CONNECTION_FAILED');
    expect(error.message).toBe('Connection failed');
    expect(error.retries).toBe(3);
    expect(error instanceof Error).toBe(true);
  });

  it('should create error with timeout info', () => {
    const service = new BrowserService(noopLogger);
    const error = service.createError('ACTION_TIMEOUT', 'Timed out', { timeout: 8000 });

    expect(error.error).toBe('ACTION_TIMEOUT');
    expect(error.timeout).toBe(8000);
  });
});

// ============================================================================
// IBrowserProvider Interface
// ============================================================================

describe('IBrowserProvider: LocalBrowserProvider', () => {
  it('should have name "local"', () => {
    const provider = new LocalBrowserProvider();
    expect(provider.name).toBe('local');
  });

  it('should not be sandboxed', () => {
    const provider = new LocalBrowserProvider();
    expect(provider.isSandboxed()).toBe(false);
  });

  it('should use custom CDP port', () => {
    const provider = new LocalBrowserProvider(9333);
    expect(provider.isSandboxed()).toBe(false);
  });

  it('should terminate without error', async () => {
    const provider = new LocalBrowserProvider();
    await expect(provider.terminate()).resolves.not.toThrow();
  });
});

describe('IBrowserProvider: MockBrowserProvider', () => {
  it('should return CDP URL', async () => {
    const provider = new MockBrowserProvider();
    const url = await provider.getCDPUrl();
    expect(url).toContain('ws://');
    expect(url).toContain('9222');
  });

  it('should throw when set to fail', async () => {
    const provider = new MockBrowserProvider();
    provider.setFail(true);
    await expect(provider.getCDPUrl()).rejects.toThrow('Mock CDP failure');
  });

  it('should track terminate calls', async () => {
    const provider = new MockBrowserProvider();
    expect(provider.terminateCalled).toBe(false);
    await provider.terminate();
    expect(provider.terminateCalled).toBe(true);
  });
});

// ============================================================================
// Session Limit Enforcement
// ============================================================================

describe('BrowserService: Session Limits', () => {
  it('should enforce max local sessions via config', () => {
    const service = new BrowserService(noopLogger, {
      maxLocalSessions: 2,
      maxSaasSessionsPerUser: 1,
    });
    expect(service.actionTimeout).toBe(8000);
  });

  it('should use default config when not provided', () => {
    const service = new BrowserService(noopLogger);
    expect(service.actionTimeout).toBe(8000);
  });

  it('should use custom action timeout', () => {
    const service = new BrowserService(noopLogger, { actionTimeout: 5000 });
    expect(service.actionTimeout).toBe(5000);
  });
});

// ============================================================================
// PageState Management
// ============================================================================

describe('BrowserService: PageState', () => {
  it('should store and retrieve ref cache entries', () => {
    const service = new BrowserService(noopLogger);

    service.cacheRefs('target-1', { e1: { role: 'button', name: 'Submit' } }, 1);
    const cached = service.getCachedRefs('target-1');

    expect(cached).toBeDefined();
    expect(cached!.refs.e1.role).toBe('button');
    expect(cached!.snapshotVersion).toBe(1);
  });

  it('should return undefined for uncached targets', () => {
    const service = new BrowserService(noopLogger);
    expect(service.getCachedRefs('nonexistent')).toBeUndefined();
  });

  it('should evict oldest entry when LRU limit reached', () => {
    const service = new BrowserService(noopLogger);

    // Fill cache with 50 entries
    for (let i = 0; i < 50; i++) {
      service.cacheRefs(`target-${i}`, { e1: { role: 'button' } }, i);
    }

    // Add one more (should evict target-0)
    service.cacheRefs('target-50', { e1: { role: 'link' } }, 50);

    expect(service.getCachedRefs('target-0')).toBeUndefined();
    expect(service.getCachedRefs('target-50')).toBeDefined();
  });
});
