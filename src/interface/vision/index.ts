/**
 * Vision Module Exports
 * Phase 4: External Interface + Engine
 */

// Interface layer (REST + WebSocket)
export { ScreenCapture } from './ScreenCapture.js';
export type { CaptureOptions } from './ScreenCapture.js';
export { GeminiVision } from './GeminiVision.js';
export { GeminiLive } from './GeminiLive.js';
export type { GeminiContent } from './GeminiLive.js';
export { VisionInterface } from './VisionInterface.js';
export type { VisionConfig } from './VisionInterface.js';

// Engine layer (multi-source capture + session management)
export { ScreenCaptureEngine, LocalCaptureSource, CDPCaptureSource, RemoteCaptureSource } from './ScreenCaptureEngine.js';
export { AdaptiveFrameSampler } from './AdaptiveFrameSampler.js';
export { GeminiLiveStream } from './GeminiLiveStream.js';
export type { StreamEvent } from './GeminiLiveStream.js';
export { VisionSession, VisionSessionManager } from './VisionSession.js';
export type { VisionSessionEvents } from './VisionSession.js';

// Types
export type {
  CaptureMode,
  CaptureSourceType,
  CaptureRegion,
  CaptureResult,
  ICaptureSource,
  FrameSamplerConfig,
  FrameSample,
  VisionSessionState,
  VisionSessionConfig,
  VisionSessionInfo,
  VisionErrorCode,
  VisionError,
  VisionLogger,
} from './types.js';
export { DEFAULT_SAMPLER_CONFIG, DEFAULT_VISION_SESSION_CONFIG, createVisionError } from './types.js';
