/**
 * Antigravity Chat API (generateContent)
 *
 * API Key → Google AI Studio
 */

import { sleep } from '../utils.js';
import { getAuthInfo, getApiKeyFromConfig } from './auth.js';
import { getModelOverride } from '../config/GlobalConfigManager.js';
import {
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './constants.js';
import type {
  AntigravityModelInfo,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  AntigravityApiResponse,
} from './types.js';

// =============================================
// 모델 레지스트리
// =============================================

export function getAntigravityModels(): Record<string, AntigravityModelInfo> {
  const proId = getModelOverride('antigravity') ?? process.env.ANTIGRAVITY_MODEL ?? 'gemini-3.1-pro-preview';
  const flashId = process.env.ANTIGRAVITY_FAST_MODEL ?? 'gemini-3.1-flash-lite-preview';

  return {
    'antigravity-pro': {
      id: proId,
      name: 'Antigravity Pro',
      description: 'Pro model for complex tasks',
      maxTokens: 8192,
    },
    'antigravity-fast': {
      id: flashId,
      name: 'Antigravity Fast',
      description: 'Fast model for lightweight tasks',
      maxTokens: 8192,
    },
  };
}

export const ANTIGRAVITY_MODELS = getAntigravityModels();

export const DEFAULT_MODEL = 'antigravity-fast';

// =============================================
// API Key 방식 (Google AI Studio)
// =============================================

async function chatWithApiKey(
  apiKey: string,
  options: ChatOptions,
): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
    jsonMode = false,
  } = options;

  const models = getAntigravityModels();
  const modelInfo = models[model] || models[DEFAULT_MODEL];
  const actualModel = modelInfo.id;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
    temperature,
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemPrompt) {
    requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const retryCount = options._retryCount || 0;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429 && retryCount < MAX_RETRIES) {
        await sleep(Math.pow(2, retryCount) * RETRY_BASE_DELAY_MS);
        return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
      }

      let errorMessage = `Google AI API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) errorMessage = errorJson.error.message;
      } catch { /* ignore */ }

      throw new Error(errorMessage);
    }

    const result = await response.json() as AntigravityApiResponse;
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('Antigravity API response is empty.');
    }

    const candidate = result.candidates[0];
    return {
      content: candidate.content?.parts?.[0]?.text || '',
      model: actualModel,
      finishReason: candidate.finishReason,
      usage: result.usageMetadata,
    };
  } catch (error) {
    if ((error as Error).name === 'TypeError' && retryCount < MAX_RETRIES) {
      await sleep(Math.pow(2, retryCount) * RETRY_BASE_DELAY_MS);
      return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  }
}

// =============================================
// Public API
// =============================================

/**
 * Antigravity API 호출 (API Key)
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const authInfo = await getAuthInfo();

  if (authInfo.apiKey) {
    return chatWithApiKey(authInfo.apiKey, options);
  }

  throw new Error('Antigravity API key not found.');
}

/**
 * 스트리밍 Chat (API Key → 단일 yield)
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const result = await chat(options);
  yield {
    content: result.content,
    done: true,
    model: result.model,
    finishReason: result.finishReason,
    usage: result.usage,
  };
}

/**
 * 사용 가능한 모델 목록
 */
export function getAvailableModels(): AntigravityModelInfo[] {
  return Object.values(getAntigravityModels());
}

/**
 * 모델 정보 가져오기
 */
export function getModelInfo(modelId: string): AntigravityModelInfo | null {
  return getAntigravityModels()[modelId] || null;
}

/**
 * 간단한 질문-응답
 */
export async function ask(
  prompt: string,
  options: Omit<ChatOptions, 'messages'> = {},
): Promise<string> {
  const result = await chat({
    ...options,
    messages: [{ role: 'user', content: prompt }],
  });
  return result.content;
}

/**
 * 코드 탐색용 빠른 질문 (Antigravity Fast)
 */
export async function quickAsk(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'antigravity-fast',
    maxTokens: 2048,
    temperature: 0.3,
  });
}
