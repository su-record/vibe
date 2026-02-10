/**
 * Vision Pipeline Types
 *
 * Phase 4: Screen Capture, Adaptive Sampling, Vision Session.
 */

// ============================================================================
// Capture Types
// ============================================================================

export type CaptureMode = 'full' | 'region' | 'window';

export type CaptureSourceType = 'local' | 'cdp' | 'remote';

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'webp' | 'png' | 'jpeg';
  sizeBytes: number;
  capturedAt: string;
  mode: CaptureMode;
}

export interface ICaptureSource {
  readonly type: CaptureSourceType;
  captureFullScreen(): Promise<CaptureResult>;
  captureRegion(region: CaptureRegion): Promise<CaptureResult>;
  captureWindow(windowId: string): Promise<CaptureResult>;
  isAvailable(): boolean;
}

// ============================================================================
// Adaptive Frame Sampler Types
// ============================================================================

export interface FrameSamplerConfig {
  /** 최소 FPS (프레임 스킵 후에도 보장) */
  minFps: number;
  /** 최대 FPS */
  maxFps: number;
  /** diff 임계값 (0~1, 이 이상 변경 시 프레임 전송) */
  diffThreshold: number;
  /** 다운샘플 해시 크기 (기본 16 = 16x16 = 256 pixels) */
  hashSize: number;
}

export const DEFAULT_SAMPLER_CONFIG: Readonly<FrameSamplerConfig> = {
  minFps: 1,
  maxFps: 5,
  diffThreshold: 0.05,
  hashSize: 16,
};

export interface FrameSample {
  buffer: Buffer;
  hash: string;
  isKeyFrame: boolean;
  frameIndex: number;
  timestamp: number;
}

// ============================================================================
// Vision Session Types
// ============================================================================

export type VisionSessionState = 'idle' | 'capturing' | 'streaming' | 'paused' | 'ended';

export interface VisionSessionConfig {
  /** 비활성 타임아웃 (ms, 기본 10분) */
  inactivityTimeoutMs: number;
  /** 최대 세션 시간 (ms, 기본 5분 — 비용 캡) */
  maxDurationMs: number;
  /** 초기 캡처 모드 */
  initialMode: CaptureMode;
  /** 초기 Region (mode가 region일 때) */
  initialRegion?: CaptureRegion;
  /** 초기 윈도우 ID (mode가 window일 때) */
  initialWindowId?: string;
}

export const DEFAULT_VISION_SESSION_CONFIG: Readonly<VisionSessionConfig> = {
  inactivityTimeoutMs: 10 * 60 * 1000,
  maxDurationMs: 5 * 60 * 1000,
  initialMode: 'full',
};

export interface VisionSessionInfo {
  sessionId: string;
  state: VisionSessionState;
  mode: CaptureMode;
  framesSent: number;
  framesSkipped: number;
  startedAt: string;
  lastActivityAt: string;
  elapsedMs: number;
}

// ============================================================================
// Vision Error Types
// ============================================================================

export type VisionErrorCode =
  | 'CAPTURE_FAILED'
  | 'CAPTURE_PERMISSION_DENIED'
  | 'WINDOW_NOT_FOUND'
  | 'REGION_INVALID'
  | 'GEMINI_CONNECTION_FAILED'
  | 'SESSION_TIMEOUT'
  | 'SESSION_ENDED'
  | 'MAX_DURATION_EXCEEDED'
  | 'ALL_SOURCES_FAILED';

export interface VisionError extends Error {
  code: VisionErrorCode;
}

export function createVisionError(code: VisionErrorCode, message: string): VisionError {
  const error = new Error(message) as VisionError;
  error.code = code;
  return error;
}

// ============================================================================
// Logger Type
// ============================================================================

export type VisionLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type VisionLogger = (level: VisionLogLevel, message: string, data?: unknown) => void;
