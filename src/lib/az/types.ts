/**
 * Azure Foundry API 타입 정의
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

export interface VibeAzOptions {
  maxTokens?: number;
  jsonMode?: boolean;
  taskType?: import('../az-constants.js').AzTaskType;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
}

