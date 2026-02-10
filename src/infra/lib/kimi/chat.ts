/**
 * Kimi K2.5 Chat API (Moonshot Direct)
 * 엔드포인트: api.moonshot.ai/v1/chat/completions
 */

import { getAuthInfo } from './auth.js';
import {
  KIMI_BASE_URL,
  KIMI_MODELS,
  KIMI_DEFAULT_MODEL,
  KIMI_MODEL_MAP,
  getKimiModelConfig,
} from '../kimi-constants.js';
import type { ChatOptions, ChatResponse, ChatMessage } from './types.js';
import type { KimiModelMeta } from '../kimi-constants.js';

const API_TIMEOUT_MS = 60_000;

interface OpenAIApiResponse {
  choices: Array<{
    message: { role: string; content: string | null; reasoning_content?: string | null };
    finish_reason: string;
  }>;
  model: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function chatWithApiKey(apiKey: string, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = KIMI_DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature,
    systemPrompt = '',
  } = options;

  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  const apiMessages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  const actualModel = KIMI_MODEL_MAP[model] || model;
  const modelConfig = getKimiModelConfig(model);

  const finalTemp = temperature ?? modelConfig.recommendedTemp;

  const requestBody: Record<string, unknown> = {
    model: actualModel,
    messages: apiMessages,
    max_tokens: maxTokens,
    temperature: finalTemp,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();

      // 429/5xx: retryable
      if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 2000;
        await sleep(delay);
        return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
      }

      let errorMessage = `Kimi API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore parse error */ }

      throw new Error(errorMessage);
    }

    const result = await response.json() as OpenAIApiResponse;
    const msg = result.choices[0]?.message;
    return {
      content: msg?.content || msg?.reasoning_content || '',
      reasoning: msg?.reasoning_content || undefined,
      model: result.model,
      finishReason: result.choices[0]?.finish_reason || 'stop',
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Kimi API timeout (${API_TIMEOUT_MS / 1000}s)`);
    }
    if ((error as Error).name === 'TypeError' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 2000;
      await sleep(delay);
      return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Kimi Direct 채팅 요청
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const auth = await getAuthInfo();
  return chatWithApiKey(auth.apiKey, options);
}

/**
 * 간단한 질문
 */
export async function ask(prompt: string, options: Partial<ChatOptions> = {}): Promise<string> {
  const result = await chat({
    ...options,
    messages: [{ role: 'user', content: prompt }],
  });
  return result.content;
}

/**
 * 빠른 질문 (기본 설정)
 */
export async function quickAsk(prompt: string): Promise<string> {
  return ask(prompt, { temperature: 0.3 });
}

/**
 * 사용 가능한 모델 목록
 */
export function getAvailableModels(): KimiModelMeta[] {
  return Object.values(KIMI_MODELS);
}

export { KIMI_MODELS };
export type { ChatMessage };
