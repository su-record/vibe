/**
 * Gemini / Antigravity API 타입 정의
 */

// =============================================
// Auth
// =============================================

export type GeminiAuthMethod = 'antigravity' | 'gemini-cli' | 'apikey';

export interface AuthInfo {
  type: GeminiAuthMethod;
  accessToken?: string;
  apiKey?: string;
  email?: string;
  projectId?: string;
  refreshToken?: string;
  tokenUri?: string;
  expiryDate?: number;
  clientId?: string;
  clientSecret?: string;
}

// =============================================
// Model
// =============================================

export interface GeminiModelInfo {
  id: string;
  /** v1internal (OAuth) 전용 모델 ID (없으면 id 사용) */
  oauthId: string;
  name: string;
  description: string;
  maxTokens: number;
}

export interface AvailableModel {
  modelId: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedActions: string[];
}

// =============================================
// Chat (generateContent)
// =============================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

export interface ChatOptions {
  model?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  webSearch?: boolean;
  jsonMode?: boolean;
  /** 내부 재시도 카운터 */
  _retryCount?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  finishReason?: string;
  usage?: unknown;
}

/** SSE 스트리밍 청크 */
export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
  finishReason?: string;
  usage?: unknown;
}

export interface GeminiApiResponse {
  response?: {
    candidates?: GeminiCandidate[];
    usageMetadata?: unknown;
  };
  candidates?: GeminiCandidate[];
  usageMetadata?: unknown;
}

export interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  finishReason?: string;
}

// =============================================
// Code Completion (completeCode)
// =============================================

export interface CompleteCodeOptions {
  /** 커서 앞 텍스트 */
  prefix: string;
  /** 커서 뒤 텍스트 */
  suffix?: string;
  /** 프로그래밍 언어 */
  language?: string;
  /** 최대 토큰 수 */
  maxTokens?: number;
  /** 모델 선택 */
  model?: string;
  /** 내부 재시도 카운터 */
  _retryCount?: number;
}

export interface CompleteCodeResponse {
  completions: string[];
  model: string;
}

// =============================================
// Image / Audio / Multimodal
// =============================================

export interface ImageGenerationOptions {
  size?: string;
  output?: string;
  model?: 'nano-banana' | 'nano-banana-pro';
}

export interface ImageGenerationResult {
  data: Buffer;
  mimeType: string;
}

export interface ImageAnalysisOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export type MultimodalContent = {
  role: 'user';
  parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }>;
};

export type AudioMimeType =
  | 'audio/wav'
  | 'audio/mp3'
  | 'audio/mpeg'
  | 'audio/aiff'
  | 'audio/aac'
  | 'audio/ogg'
  | 'audio/flac'
  | 'audio/webm';

export interface AudioTranscriptionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  language?: string;
  systemPrompt?: string;
}

export interface AudioTranscriptionResult {
  transcription: string;
  model: string;
  duration?: number;
}

// =============================================
// Orchestration
// =============================================

export interface VibeGeminiOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}

// =============================================
// v1internal Request Wrapper
// =============================================

export interface V1InternalRequest {
  project: string;
  model: string;
  request: unknown;
}
