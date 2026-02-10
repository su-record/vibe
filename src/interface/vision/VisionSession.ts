/**
 * Vision Session — Phase 4-2
 *
 * Session lifecycle: idle → capturing → streaming → paused → ended.
 * Inactivity timeout (10 min), max duration (5 min cost cap).
 * Mode switching: full ↔ region ↔ window.
 */

import type {
  CaptureMode,
  CaptureRegion,
  CaptureResult,
  VisionSessionState,
  VisionSessionConfig,
  VisionSessionInfo,
  VisionLogger,
} from './types.js';
import { DEFAULT_VISION_SESSION_CONFIG, createVisionError } from './types.js';
import { ScreenCaptureEngine } from './ScreenCaptureEngine.js';
import { AdaptiveFrameSampler } from './AdaptiveFrameSampler.js';
import type { FrameSample } from './types.js';

// ============================================================================
// Event types
// ============================================================================

export interface VisionSessionEvents {
  frame: (sample: FrameSample) => void;
  stateChange: (state: VisionSessionState) => void;
  error: (error: Error) => void;
  ended: (reason: string) => void;
}

// ============================================================================
// Vision Session
// ============================================================================

export class VisionSession {
  readonly sessionId: string;
  private state: VisionSessionState = 'idle';
  private mode: CaptureMode;
  private region?: CaptureRegion;
  private windowId?: string;
  private config: VisionSessionConfig;
  private logger: VisionLogger;
  private engine: ScreenCaptureEngine;
  private sampler: AdaptiveFrameSampler;
  private captureTimer: NodeJS.Timeout | null = null;
  private capturing = false;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private maxDurationTimer: NodeJS.Timeout | null = null;
  private startedAt: string;
  private lastActivityAt: string;
  private framesSent = 0;
  private framesSkipped = 0;
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(
    sessionId: string,
    engine: ScreenCaptureEngine,
    logger: VisionLogger,
    config?: Partial<VisionSessionConfig>,
  ) {
    this.sessionId = sessionId;
    this.engine = engine;
    this.logger = logger;
    this.config = { ...DEFAULT_VISION_SESSION_CONFIG, ...config };
    this.mode = this.config.initialMode;
    this.region = this.config.initialRegion;
    this.windowId = this.config.initialWindowId;
    this.sampler = new AdaptiveFrameSampler(logger);
    this.startedAt = new Date().toISOString();
    this.lastActivityAt = this.startedAt;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  start(): void {
    if (this.state !== 'idle') {
      throw createVisionError('SESSION_ENDED', '세션이 이미 시작되었습니다.');
    }
    this.setState('capturing');
    this.setupTimers();
    this.startCapturing();
  }

  pause(): void {
    if (this.state !== 'capturing' && this.state !== 'streaming') return;
    this.stopCapturing();
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('capturing');
    this.startCapturing();
  }

  end(reason: string = 'user_request'): void {
    if (this.state === 'ended') return;
    this.stopCapturing();
    this.clearTimers();
    this.sampler.reset();
    this.setState('ended');
    this.emit('ended', reason);
    this.logger('info', `Vision session ended: ${reason}`);
  }

  // ============================================================================
  // Mode switching
  // ============================================================================

  changeMode(mode: CaptureMode, region?: CaptureRegion, windowId?: string): void {
    if (this.state === 'ended' || this.state === 'idle') {
      throw createVisionError('SESSION_ENDED', '세션이 활성 상태가 아닙니다.');
    }
    this.mode = mode;
    this.region = region;
    this.windowId = windowId;
    this.touchActivity();
    this.logger('info', `Vision mode changed to ${mode}`);
  }

  // ============================================================================
  // Single snapshot
  // ============================================================================

  async snapshot(): Promise<CaptureResult> {
    this.touchActivity();
    return this.engine.capture(this.mode, this.region, this.windowId);
  }

  // ============================================================================
  // Event emitter
  // ============================================================================

  on<K extends keyof VisionSessionEvents>(event: K, listener: VisionSessionEvents[K]): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as (...args: unknown[]) => void);
    this.listeners.set(event, list);
  }

  off<K extends keyof VisionSessionEvents>(event: K, listener: VisionSessionEvents[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(listener as (...args: unknown[]) => void);
    if (idx !== -1) list.splice(idx, 1);
  }

  // ============================================================================
  // Info
  // ============================================================================

  getInfo(): VisionSessionInfo {
    const now = new Date();
    return {
      sessionId: this.sessionId,
      state: this.state,
      mode: this.mode,
      framesSent: this.framesSent,
      framesSkipped: this.framesSkipped,
      startedAt: this.startedAt,
      lastActivityAt: this.lastActivityAt,
      elapsedMs: now.getTime() - new Date(this.startedAt).getTime(),
    };
  }

  getState(): VisionSessionState {
    return this.state;
  }

  // ============================================================================
  // Private: Capture loop
  // ============================================================================

  private startCapturing(): void {
    // Capture at ~2 FPS (500ms interval)
    const intervalMs = 500;
    this.captureTimer = setInterval(() => {
      this.captureOnce().catch((err) => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      });
    }, intervalMs);
  }

  private stopCapturing(): void {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }
  }

  private async captureOnce(): Promise<void> {
    if (this.state !== 'capturing' && this.state !== 'streaming') return;
    if (this.capturing) return; // Prevent concurrent capture pile-up
    this.capturing = true;

    try {
      const result = await this.engine.capture(this.mode, this.region, this.windowId);
      const sample = this.sampler.processFrame(result.buffer, Date.now());

      if (sample) {
        this.framesSent++;
        this.touchActivity();
        this.emit('frame', sample);
        if (this.state === 'capturing') this.setState('streaming');
      } else {
        this.framesSkipped++;
      }
    } catch (err) {
      this.logger('error', `Capture failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.capturing = false;
    }
  }

  // ============================================================================
  // Private: Timers
  // ============================================================================

  private setupTimers(): void {
    // Inactivity timeout
    this.resetInactivityTimer();

    // Max duration timer
    this.maxDurationTimer = setTimeout(() => {
      this.end('max_duration_exceeded');
    }, this.config.maxDurationMs);
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      this.end('inactivity_timeout');
    }, this.config.inactivityTimeoutMs);
  }

  private clearTimers(): void {
    if (this.inactivityTimer) { clearTimeout(this.inactivityTimer); this.inactivityTimer = null; }
    if (this.maxDurationTimer) { clearTimeout(this.maxDurationTimer); this.maxDurationTimer = null; }
  }

  private touchActivity(): void {
    this.lastActivityAt = new Date().toISOString();
    this.resetInactivityTimer();
  }

  // ============================================================================
  // Private: State & emit
  // ============================================================================

  private setState(state: VisionSessionState): void {
    this.state = state;
    this.emit('stateChange', state);
  }

  private emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const fn of list) {
      try { fn(...args); } catch { /* ignore listener errors */ }
    }
  }
}

// ============================================================================
// Vision Session Manager
// ============================================================================

export class VisionSessionManager {
  private sessions = new Map<string, VisionSession>();
  private logger: VisionLogger;

  constructor(logger: VisionLogger) {
    this.logger = logger;
  }

  create(
    userId: string,
    engine: ScreenCaptureEngine,
    config?: Partial<VisionSessionConfig>,
  ): VisionSession {
    // Enforce single session per user
    const existing = this.sessions.get(userId);
    if (existing && existing.getState() !== 'ended') {
      existing.end('replaced_by_new_session');
    }

    const sessionId = `vision-${userId}-${Date.now()}`;
    const session = new VisionSession(sessionId, engine, this.logger, config);
    this.sessions.set(userId, session);
    return session;
  }

  get(userId: string): VisionSession | undefined {
    const session = this.sessions.get(userId);
    if (session && session.getState() === 'ended') {
      this.sessions.delete(userId);
      return undefined;
    }
    return session;
  }

  endAll(): void {
    for (const session of this.sessions.values()) {
      if (session.getState() !== 'ended') {
        session.end('shutdown');
      }
    }
    this.sessions.clear();
  }

  getActiveSessions(): VisionSessionInfo[] {
    const active: VisionSessionInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.getState() !== 'ended') {
        active.push(session.getInfo());
      }
    }
    return active;
  }
}
