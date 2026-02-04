/**
 * Gemini API 타입 정의
 */

export interface AuthInfo {
  type: 'oauth' | 'apikey';
  accessToken?: string;
  apiKey?: string;
  email?: string;
  projectId?: string;
}

export interface GeminiModelInfo {
  id: string;
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
