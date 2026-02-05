/**
 * Kimi API 타입 정의
 */

export interface AuthInfo {
  type: 'apikey';
  apiKey: string;
}

export interface KimiModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
  cost: number;
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
  model: string;
  finishReason: string;
}

export interface VibeKimiOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}
