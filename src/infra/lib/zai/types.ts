/**
 * ZAI (Z.ai / GLM) 타입 정의 — OpenAI 호환 API
 */

/** ZAI 요금제: coding = GLM Coding Plan(별도 키), general = 일반 pay-as-you-go */
export type ZaiPlan = 'coding' | 'general';

export interface ZaiModelInfo {
  id: string;
  name: string;
  description: string;
  /** flagship(최고) 모델 여부 */
  top?: boolean;
}

export interface ZaiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ZaiChatOptions {
  messages: ZaiChatMessage[];
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  plan?: ZaiPlan;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ZaiChatResponse {
  content: string;
  model: string;
  finishReason?: string;
}

export interface VibeZaiOptions {
  maxTokens?: number;
  jsonMode?: boolean;
  plan?: ZaiPlan;
  signal?: AbortSignal;
  timeoutMs?: number;
}
