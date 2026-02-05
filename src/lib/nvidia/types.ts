/**
 * NVIDIA NIM API 타입 정의
 */

export interface AuthInfo {
  type: 'apikey';
  apiKey: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  model?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  _retryCount?: number;
}

export interface ChatResponse {
  content: string;
  reasoning?: string;
  model: string;
  finishReason: string;
}

export interface VibeNvidiaOptions {
  maxTokens?: number;
  jsonMode?: boolean;
  taskType?: import('../nvidia-constants.js').NvidiaTaskType;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
}

// 하위 호환
/** @deprecated Use VibeNvidiaOptions */
export type VibeKimiOptions = VibeNvidiaOptions;
