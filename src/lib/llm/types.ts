/**
 * LLM Provider Types - Shared types for GPT and Gemini providers
 */

export type LLMProvider = 'gpt' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  webSearch?: boolean;
  jsonMode?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface AuthInfo {
  type: 'oauth' | 'apikey';
  accessToken?: string;
  apiKey?: string;
  email?: string;
  projectId?: string;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  contextWindow?: number;
  capabilities?: string[];
}

export interface OrchestrationOptions {
  maxTokens?: number;
  jsonMode?: boolean;
  model?: string;
}

/**
 * Abstract LLM Provider interface
 */
export interface ILLMProvider {
  readonly name: LLMProvider;

  /**
   * Check if the provider is available (has valid auth)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Send a chat request
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * Stream a chat response
   */
  chatStream?(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk>;

  /**
   * Get available models
   */
  getModels(): LLMModelInfo[];

  /**
   * Simple ask method
   */
  ask(prompt: string, options?: ChatOptions): Promise<string>;
}

/**
 * LLM availability cache entry
 */
export interface LLMAvailabilityCacheEntry {
  available: boolean;
  checkedAt: number;
  errorCount: number;
  lastError?: string;
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryablePatterns: string[];
}

export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryablePatterns: [
    'rate limit',
    'too many requests',
    '429',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
};
