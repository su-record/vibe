/**
 * Gemini API 타입 정의
 */

// Gemini 인증 방식
export type GeminiAuthMethod = 'oauth' | 'gemini-cli' | 'apikey';

export interface AuthInfo {
  type: GeminiAuthMethod;
  accessToken?: string;
  apiKey?: string;
  email?: string;
  projectId?: string;
  refreshToken?: string;
  tokenUri?: string;
  expiryDate?: number;
}

export interface GeminiModelInfo {
  /** API Key (Google AI Studio) 모델 ID */
  id: string;
  /** OAuth/CLI (Antigravity v1internal) 모델 ID — 없으면 id 사용 */
  oauthId?: string;
  name: string;
  description: string;
  maxTokens: number;
}

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
  _retryCount?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  finishReason?: string;
  usage?: unknown;
}

export interface GeminiApiResponse {
  response?: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: unknown;
  };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: unknown;
}

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
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
};

export interface VibeGeminiOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}

// Audio transcription types
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
