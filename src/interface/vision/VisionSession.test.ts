/**
 * VisionSession Tests
 *
 * Tests for session lifecycle, mode switching, timers, and session manager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VisionSession, VisionSessionManager } from './VisionSession.js';
import { ScreenCaptureEngine } from './ScreenCaptureEngine.js';
import type { ICaptureSource, CaptureResult, VisionLogger, VisionSessionState } from './types.js';

function createLogger(): VisionLogger {
  return vi.fn();
}

function mockCaptureResult(mode: 'full' | 'region' | 'window' = 'full'): CaptureResult {
  return {
    buffer: Buffer.from('fake-capture-data'),
    width: 1280,
    height: 720,
    format: 'webp',
    sizeBytes: 17,
    capturedAt: new Date().toISOString(),
    mode,
  };
}

class MockSource implements ICaptureSource {
  readonly type = 'local' as const;
  isAvailable(): boolean { return true; }
  async captureFullScreen(): Promise<CaptureResult> { return mockCaptureResult('full'); }
  async captureRegion(): Promise<CaptureResult> { return mockCaptureResult('region'); }
  async captureWindow(): Promise<CaptureResult> { return mockCaptureResult('window'); }
}

describe('VisionSession', () => {
  let session: VisionSession;
  let logger: VisionLogger;
  let engine: ScreenCaptureEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createLogger();
    engine = new ScreenCaptureEngine([new MockSource()], logger);
    session = new VisionSession('test-session', engine, logger, {
      inactivityTimeoutMs: 5000,
      maxDurationMs: 10000,
      initialMode: 'full',
    });
  });

  afterEach(() => {
    session.end('test_cleanup');
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should start in idle state', () => {
      expect(session.getState()).toBe('idle');
    });

    it('should transition to capturing on start', () => {
      session.start();
      expect(session.getState()).toBe('capturing');
    });

    it('should transition to paused', () => {
      session.start();
      session.pause();
      expect(session.getState()).toBe('paused');
    });

    it('should resume from paused to capturing', () => {
      session.start();
      session.pause();
      session.resume();
      expect(session.getState()).toBe('capturing');
    });

    it('should transition to ended', () => {
      session.start();
      session.end('test');
      expect(session.getState()).toBe('ended');
    });

    it('should not start twice', () => {
      session.start();
      expect(() => session.start()).toThrow('세션이 이미 시작되었습니다.');
    });

    it('should emit stateChange events', () => {
      const states: VisionSessionState[] = [];
      session.on('stateChange', (s) => states.push(s));
      session.start();
      session.pause();
      session.resume();
      session.end('test');
      expect(states).toEqual(['capturing', 'paused', 'capturing', 'ended']);
    });

    it('should emit ended event with reason', () => {
      let endReason = '';
      session.on('ended', (reason) => { endReason = reason as string; });
      session.start();
      session.end('user_request');
      expect(endReason).toBe('user_request');
    });
  });

  describe('mode switching', () => {
    it('should change mode', () => {
      session.start();
      session.changeMode('region', { x: 0, y: 0, width: 800, height: 600 });
      expect(session.getInfo().mode).toBe('region');
    });

    it('should not change mode when idle', () => {
      expect(() => session.changeMode('region')).toThrow('세션이 활성 상태가 아닙니다.');
    });

    it('should not change mode when ended', () => {
      session.start();
      session.end('test');
      expect(() => session.changeMode('region')).toThrow('세션이 활성 상태가 아닙니다.');
    });
  });

  describe('info', () => {
    it('should return session info', () => {
      session.start();
      const info = session.getInfo();
      expect(info.sessionId).toBe('test-session');
      expect(info.state).toBe('capturing');
      expect(info.mode).toBe('full');
      expect(info.framesSent).toBe(0);
      expect(info.framesSkipped).toBe(0);
    });
  });

  describe('timers', () => {
    it('should auto-end on max duration', () => {
      // Create session with inactivity > maxDuration so maxDuration fires first
      const shortSession = new VisionSession('max-dur-test', engine, logger, {
        inactivityTimeoutMs: 60_000,
        maxDurationMs: 3_000,
        initialMode: 'full',
      });
      let endReason = '';
      shortSession.on('ended', (r) => { endReason = r as string; });
      shortSession.start();

      vi.advanceTimersByTime(3_001);
      expect(shortSession.getState()).toBe('ended');
      expect(endReason).toBe('max_duration_exceeded');
    });

    it('should auto-end on inactivity', () => {
      let endReason = '';
      session.on('ended', (r) => { endReason = r as string; });
      session.start();

      vi.advanceTimersByTime(5_001);
      expect(session.getState()).toBe('ended');
      expect(endReason).toBe('inactivity_timeout');
    });
  });

  describe('snapshot', () => {
    it('should return capture result', async () => {
      session.start();
      const result = await session.snapshot();
      expect(result).toBeDefined();
      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('event listener cleanup', () => {
    it('should support off() to remove listeners', () => {
      const states: VisionSessionState[] = [];
      const listener = (s: VisionSessionState): void => { states.push(s); };
      session.on('stateChange', listener);
      session.start(); // capturing
      session.off('stateChange', listener);
      session.pause(); // paused — should not be recorded
      expect(states).toEqual(['capturing']);
    });
  });
});

describe('VisionSessionManager', () => {
  let manager: VisionSessionManager;
  let logger: VisionLogger;
  let engine: ScreenCaptureEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createLogger();
    engine = new ScreenCaptureEngine([new MockSource()], logger);
    manager = new VisionSessionManager(logger);
  });

  afterEach(() => {
    manager.endAll();
    vi.useRealTimers();
  });

  it('should create a session', () => {
    const session = manager.create('user1', engine);
    expect(session.sessionId).toContain('vision-user1');
  });

  it('should get active session', () => {
    const session = manager.create('user1', engine);
    session.start();
    const found = manager.get('user1');
    expect(found).toBe(session);
  });

  it('should enforce single session per user', () => {
    const s1 = manager.create('user1', engine);
    s1.start();
    const s2 = manager.create('user1', engine);
    expect(s1.getState()).toBe('ended');
    expect(s2).toBeDefined();
  });

  it('should endAll sessions', () => {
    const s1 = manager.create('user1', engine);
    const s2 = manager.create('user2', engine);
    s1.start();
    s2.start();

    manager.endAll();
    expect(s1.getState()).toBe('ended');
    expect(s2.getState()).toBe('ended');
  });

  it('should list active sessions', () => {
    const s1 = manager.create('user1', engine);
    s1.start();
    const active = manager.getActiveSessions();
    expect(active).toHaveLength(1);
    expect(active[0].sessionId).toContain('user1');
  });

  it('should return undefined for ended session', () => {
    const s1 = manager.create('user1', engine);
    s1.start();
    s1.end('test');
    const found = manager.get('user1');
    expect(found).toBeUndefined();
  });
});
