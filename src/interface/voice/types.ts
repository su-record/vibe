/**
 * Voice Pipeline Types
 *
 * Phase 3: STT/TTS/VAD/WebSocket/Session 타입 정의.
 */

// ============================================================================
// STT Types
// ============================================================================

export type STTProviderName = 'gemini' | 'whisper' | 'deepgram';

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  providerUsed: STTProviderName;
  durationMs: number;
}

export interface STTProviderConfig {
  name: STTProviderName;
  apiKey?: string;
  enabled: boolean;
  timeoutMs: number;
  model?: string;
}

export interface ISTTProvider {
  readonly name: STTProviderName;
  transcribe(audio: Buffer, mime: string, language?: string): Promise<STTResult>;
  isAvailable(): boolean;
}

// ============================================================================
// TTS Types
// ============================================================================

export type TTSProviderName = 'edge' | 'openai' | 'google';

export type AudioFormat = 'opus' | 'mp3' | 'wav';

export interface TTSResult {
  audioPath: string;
  format: AudioFormat;
  providerUsed: TTSProviderName;
  durationMs: number;
  sizeBytes: number;
}

export interface TTSSynthesizeOptions {
  voice?: string;
  language?: string;
  format?: AudioFormat;
  speed?: number;
}

export interface TTSProviderConfig {
  name: TTSProviderName;
  apiKey?: string;
  enabled: boolean;
  timeoutMs: number;
  voice?: string;
}

export interface ITTSProvider {
  readonly name: TTSProviderName;
  synthesize(text: string, options?: TTSSynthesizeOptions): Promise<TTSResult>;
  isAvailable(): boolean;
}

// ============================================================================
// VAD Types
// ============================================================================

export interface VADConfig {
  /** 침묵 임계값 (ms). 이 이상 침묵 시 발화 종료 */
  silenceThresholdMs: number;
  /** 최소 발화 길이 (ms). 이 미만 발화는 무시 */
  minSpeechMs: number;
  /** 에너지 임계값 (0~1). 이 이상 에너지면 음성 */
  energyThreshold: number;
}

export const DEFAULT_VAD_CONFIG: Readonly<VADConfig> = {
  silenceThresholdMs: 300,
  minSpeechMs: 500,
  energyThreshold: 0.02,
};

export interface VADEvent {
  type: 'speech_start' | 'speech_end' | 'silence';
  timestamp: number;
  /** speech_end 시 음성 데이터 (PCM 16kHz mono) */
  audioData?: Buffer;
  durationMs?: number;
}

// ============================================================================
// WebSocket Protocol Types
// ============================================================================

/** 클라이언트 → 서버 */
export type ClientMessage =
  | { type: 'audio_start'; sampleRate: number; channels: number; sessionId: string; seq: number }
  | { type: 'audio_end'; sessionId: string; seq: number }
  | { type: 'ping'; timestamp: number };

/** 서버 → 클라이언트 */
export type ServerMessage =
  | { type: 'transcript'; text: string; sessionId: string; seq: number }
  | { type: 'response_start'; sessionId: string; seq: number }
  | { type: 'response_text'; text: string; sessionId: string; seq: number }
  | { type: 'response_end'; sessionId: string; seq: number }
  | { type: 'error'; message: string; code: string }
  | { type: 'pong'; timestamp: number };

// ============================================================================
// Voice Session Types
// ============================================================================

export type VoiceSessionState = 'created' | 'active' | 'paused' | 'ended';

export interface VoiceSessionConfig {
  /** 비활성 타임아웃 (ms, 기본 5분) */
  inactivityTimeoutMs: number;
  /** 최대 녹음 시간 (ms, 기본 5분) */
  maxRecordingMs: number;
  /** Barge-in 활성화 */
  bargeInEnabled: boolean;
}

export const DEFAULT_SESSION_CONFIG: Readonly<VoiceSessionConfig> = {
  inactivityTimeoutMs: 5 * 60 * 1000,
  maxRecordingMs: 5 * 60 * 1000,
  bargeInEnabled: true,
};

export interface VoiceSessionInfo {
  sessionId: string;
  state: VoiceSessionState;
  userId: string;
  channel: string;
  createdAt: string;
  lastActivityAt: string;
  utteranceCount: number;
}

// ============================================================================
// Voice Error Types
// ============================================================================

export type VoiceErrorCode =
  | 'STT_FAILED'
  | 'TTS_FAILED'
  | 'VAD_ERROR'
  | 'SESSION_TIMEOUT'
  | 'SESSION_ENDED'
  | 'ALL_PROVIDERS_FAILED'
  | 'AUDIO_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT';

export interface VoiceError extends Error {
  code: VoiceErrorCode;
  providerErrors?: Array<{ provider: string; error: string }>;
}

export function createVoiceError(
  code: VoiceErrorCode,
  message: string,
  providerErrors?: Array<{ provider: string; error: string }>,
): VoiceError {
  const error = new Error(message) as VoiceError;
  error.code = code;
  if (providerErrors) error.providerErrors = providerErrors;
  return error;
}

// ============================================================================
// Logger Type
// ============================================================================

export type VoiceLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type VoiceLogger = (level: VoiceLogLevel, message: string, data?: unknown) => void;
