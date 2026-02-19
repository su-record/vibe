/**
 * GPT API 타입 정의
 */

// GPT 인증 방식
export type GptAuthMethod = 'oauth' | 'codex-cli' | 'apikey';

// ChatGPT 플랜 타입
export type ChatGptPlan = 'pro' | 'plus' | 'free';

// 인증 정보 타입
export interface AuthInfo {
  type: GptAuthMethod;
  accessToken?: string;
  apiKey?: string;
  email?: string;
  accountId?: string;
  plan?: ChatGptPlan;
}

// 모델 정보
export interface GptModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  reasoning: { effort: string; summary: string };
}

// 채팅 메시지
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 채팅 옵션
export interface ChatOptions {
  model?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  _retryCount?: number;
}

// 채팅 응답
export interface ChatResponse {
  content: string;
  model: string;
  finishReason: string;
}

// 스트리밍 청크
export interface StreamChunk {
  type: 'delta' | 'done';
  content?: string;
}

// OpenAI API 응답 타입
export interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface OpenAIResponse {
  choices: Array<{
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  model: string;
}

// Core GPT 오케스트레이션 옵션
export interface VibeGptOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}

// 임베딩 응답
export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
}
