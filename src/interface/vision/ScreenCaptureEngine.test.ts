/**
 * ScreenCapture Tests
 *
 * Tests for LocalCaptureSource, CDPCaptureSource, RemoteCaptureSource,
 * and ScreenCaptureEngine orchestration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LocalCaptureSource,
  CDPCaptureSource,
  RemoteCaptureSource,
  ScreenCaptureEngine,
} from './ScreenCaptureEngine.js';
import type { ICaptureSource, CaptureResult, VisionLogger } from './types.js';

function createLogger(): VisionLogger {
  return vi.fn();
}

function mockCaptureResult(mode: 'full' | 'region' | 'window' = 'full'): CaptureResult {
  return {
    buffer: Buffer.from('fake-png-data'),
    width: 1920,
    height: 1080,
    format: 'png',
    sizeBytes: 13,
    capturedAt: new Date().toISOString(),
    mode,
  };
}

/** Mock capture source for testing engine */
class MockCaptureSource implements ICaptureSource {
  readonly type = 'local' as const;
  private available: boolean;
  private shouldFail: boolean;

  constructor(available = true, shouldFail = false) {
    this.available = available;
    this.shouldFail = shouldFail;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async captureFullScreen(): Promise<CaptureResult> {
    if (this.shouldFail) throw new Error('Capture failed');
    return mockCaptureResult('full');
  }

  async captureRegion(): Promise<CaptureResult> {
    if (this.shouldFail) throw new Error('Capture failed');
    return mockCaptureResult('region');
  }

  async captureWindow(): Promise<CaptureResult> {
    if (this.shouldFail) throw new Error('Capture failed');
    return mockCaptureResult('window');
  }
}

describe('LocalCaptureSource', () => {
  let source: LocalCaptureSource;

  beforeEach(() => {
    source = new LocalCaptureSource(createLogger());
  });

  it('should report availability based on platform', () => {
    // On Windows/Mac/Linux it should be available
    const available = source.isAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should have type "local"', () => {
    expect(source.type).toBe('local');
  });
});

describe('CDPCaptureSource', () => {
  let source: CDPCaptureSource;

  beforeEach(() => {
    source = new CDPCaptureSource(createLogger());
  });

  it('should be unavailable without session', () => {
    expect(source.isAvailable()).toBe(false);
  });

  it('should be available after setting session', () => {
    source.setSession({
      send: vi.fn().mockResolvedValue({ data: Buffer.from('test').toString('base64') }),
    });
    expect(source.isAvailable()).toBe(true);
  });

  it('should capture full screen via CDP', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: Buffer.from('png-data').toString('base64'),
    });
    source.setSession({ send: mockSend });

    const result = await source.captureFullScreen();
    expect(result.mode).toBe('full');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(mockSend).toHaveBeenCalledWith('Page.captureScreenshot', { format: 'png' });
  });

  it('should capture region via CDP with clip', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      data: Buffer.from('png-data').toString('base64'),
    });
    source.setSession({ send: mockSend });

    const result = await source.captureRegion({ x: 100, y: 200, width: 800, height: 600 });
    expect(result.mode).toBe('region');
    expect(mockSend).toHaveBeenCalledWith('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 100, y: 200, width: 800, height: 600, scale: 1 },
    });
  });

  it('should throw if no CDP session', async () => {
    await expect(source.captureFullScreen()).rejects.toThrow('CDP 세션이 연결되지 않았습니다.');
  });

  it('should have type "cdp"', () => {
    expect(source.type).toBe('cdp');
  });
});

describe('RemoteCaptureSource', () => {
  let source: RemoteCaptureSource;

  beforeEach(() => {
    source = new RemoteCaptureSource();
  });

  it('should always be unavailable', () => {
    expect(source.isAvailable()).toBe(false);
  });

  it('should throw on captureFullScreen', async () => {
    await expect(source.captureFullScreen()).rejects.toThrow('Phase 6');
  });

  it('should throw on captureRegion', async () => {
    await expect(source.captureRegion({ x: 0, y: 0, width: 100, height: 100 }))
      .rejects.toThrow('Phase 6');
  });

  it('should throw on captureWindow', async () => {
    await expect(source.captureWindow('test')).rejects.toThrow('Phase 6');
  });

  it('should have type "remote"', () => {
    expect(source.type).toBe('remote');
  });
});

describe('ScreenCaptureEngine', () => {
  let logger: VisionLogger;

  beforeEach(() => {
    logger = createLogger();
  });

  it('should use first available source for full capture', async () => {
    const source = new MockCaptureSource(true);
    const engine = new ScreenCaptureEngine([source], logger);
    const result = await engine.capture('full');
    expect(result.mode).toBe('full');
  });

  it('should skip unavailable sources', async () => {
    const unavailable = new MockCaptureSource(false);
    const available = new MockCaptureSource(true);
    const engine = new ScreenCaptureEngine([unavailable, available], logger);
    const result = await engine.capture('full');
    expect(result.mode).toBe('full');
  });

  it('should throw ALL_SOURCES_FAILED when no source available', async () => {
    const engine = new ScreenCaptureEngine([new MockCaptureSource(false)], logger);
    await expect(engine.capture('full')).rejects.toThrow('사용 가능한 캡처 소스가 없습니다.');
  });

  it('should capture region with valid coordinates', async () => {
    const source = new MockCaptureSource(true);
    const engine = new ScreenCaptureEngine([source], logger);
    const result = await engine.capture('region', { x: 0, y: 0, width: 800, height: 600 });
    expect(result.mode).toBe('region');
  });

  it('should throw REGION_INVALID when region missing', async () => {
    const source = new MockCaptureSource(true);
    const engine = new ScreenCaptureEngine([source], logger);
    await expect(engine.capture('region')).rejects.toThrow('Region 좌표가 필요합니다.');
  });

  it('should throw WINDOW_NOT_FOUND when windowId missing', async () => {
    const source = new MockCaptureSource(true);
    const engine = new ScreenCaptureEngine([source], logger);
    await expect(engine.capture('window')).rejects.toThrow('윈도우 ID가 필요합니다.');
  });

  it('should capture window with valid windowId', async () => {
    const source = new MockCaptureSource(true);
    const engine = new ScreenCaptureEngine([source], logger);
    const result = await engine.capture('window', undefined, 'test-window');
    expect(result.mode).toBe('window');
  });
});
