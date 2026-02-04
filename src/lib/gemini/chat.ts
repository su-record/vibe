/**
 * Gemini 채팅 API
 * - API Key (Google AI Studio) / OAuth (Antigravity) 방식
 * - 모델 레지스트리, 채팅, 스트리밍
 */

import crypto from 'crypto';

import {
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} from '../gemini-constants.js';

import { sleep } from '../utils.js';
import { getAuthInfo, getApiKeyFromConfig } from './auth.js';
import type {
  GeminiModelInfo,
  ChatOptions,
  ChatResponse,
  GeminiApiResponse,
} from './types.js';

// Antigravity API 버전
const ANTIGRAVITY_API_VERSION = 'v1internal';

/**
 * 엔드포인트 URL 목록 (fallback 순서)
 * daily sandbox 먼저 시도 (Rate Limit 더 여유로움)
 */
const ENDPOINT_FALLBACKS = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
];

// 사용 가능한 모델 목록 (Antigravity 지원 모델)
export const GEMINI_MODELS: Record<string, GeminiModelInfo> = {
  'gemini-3-pro-high': {
    id: 'gemini-3-pro-high',
    name: 'Gemini 3 Pro (High)',
    description: 'Latest Pro, highest accuracy',
    maxTokens: 8192,
  },
  'gemini-3-pro': {
    id: 'gemini-3-pro-low',
    name: 'Gemini 3 Pro (Low)',
    description: 'Latest Pro, fast response',
    maxTokens: 8192,
  },
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    description: 'Latest Flash, fastest',
    maxTokens: 8192,
  }
};

export const DEFAULT_MODEL = 'gemini-3-flash';

/**
 * 요청 ID 생성
 */
function generateRequestId(): string {
  return `agent-${crypto.randomUUID()}`;
}

/**
 * Antigravity 요청 본문 래핑
 */
function wrapRequestBody(body: unknown, projectId: string, modelId: string): Record<string, unknown> {
  return {
    project: projectId,
    model: modelId,
    request: body,
    requestType: 'agent',
    userAgent: 'antigravity',
    requestId: generateRequestId(),
  };
}

/**
 * Google AI Studio API 호출 (API Key 방식)
 */
async function chatWithApiKey(apiKey: string, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
  } = options;

  const apiKeyModelMap: Record<string, string> = {
    'gemini-3-pro': 'gemini-3-pro-preview',
    'gemini-3-flash': 'gemini-3-flash-preview'
  };

  const actualModel = apiKeyModelMap[model] || 'gemini-3-flash-preview';

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await sleep(delay);
        return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
      }

      let errorMessage = `Google AI API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }

      throw new Error(errorMessage);
    }

    const result = await response.json() as GeminiApiResponse;

    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('Gemini API response is empty.');
    }

    const candidate = result.candidates[0];
    const content = candidate.content?.parts?.[0]?.text || '';

    return {
      content,
      model: actualModel,
      finishReason: candidate.finishReason,
      usage: result.usageMetadata,
    };
  } catch (error) {
    if ((error as Error).name === 'TypeError' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  }
}

/**
 * Gemini API 호출 (Antigravity v1internal - OAuth 방식)
 */
async function chatWithOAuth(accessToken: string, projectId: string | undefined, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
    webSearch = false,
  } = options;

  const modelInfo = GEMINI_MODELS[model] || GEMINI_MODELS[DEFAULT_MODEL];

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const innerRequest: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(maxTokens, modelInfo.maxTokens),
      temperature,
    },
  };

  if (systemPrompt) {
    innerRequest.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (webSearch) {
    innerRequest.tools = [{ googleSearch: {} }];
  }

  const requestBody = wrapRequestBody(
    innerRequest,
    projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
    modelInfo.id
  );

  const isClaudeModel = modelInfo.id.startsWith('claude-');
  const isThinkingModel = modelInfo.id.includes('thinking');

  let lastError: Error | null = null;
  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${ANTIGRAVITY_API_VERSION}:generateContent`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...ANTIGRAVITY_HEADERS,
    };

    if (isClaudeModel && isThinkingModel) {
      headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          lastError = new Error(`API not found: ${errorText}`);
          continue;
        }
        if (response.status === 429) {
          const retryCount = options._retryCount || 0;
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000;
            await sleep(delay);
            return chatWithOAuth(accessToken, projectId, { ...options, _retryCount: retryCount + 1 });
          }
        }
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as GeminiApiResponse;

      const responseData = result.response || result;
      if (!responseData.candidates || responseData.candidates.length === 0) {
        throw new Error('Gemini API response is empty.');
      }

      const candidate = responseData.candidates[0];
      const content = candidate.content?.parts?.[0]?.text || '';

      return {
        content,
        model: modelInfo.name,
        finishReason: candidate.finishReason,
        usage: responseData.usageMetadata,
      };
    } catch (error) {
      lastError = error as Error;
      if ((error as Error).name === 'TypeError' || (error as Error).message.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('All Antigravity endpoints failed');
}

/**
 * Gemini API 호출 (OAuth 또는 API Key 자동 선택 + Fallback)
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const authInfo = await getAuthInfo();
  const apiKey = getApiKeyFromConfig();

  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    return chatWithApiKey(authInfo.apiKey, options);
  }

  if (authInfo.type === 'oauth' && authInfo.accessToken) {
    try {
      return await chatWithOAuth(authInfo.accessToken, authInfo.projectId, options);
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (apiKey && (errorMsg.includes('429') || errorMsg.includes('401') || errorMsg.includes('403'))) {
        console.log('⚠️ OAuth limit exceeded/error → Switching to API Key');
        return chatWithApiKey(apiKey, options);
      }
      throw error;
    }
  }

  throw new Error('Gemini credentials not found.');
}

/**
 * 스트리밍 Chat (향후 구현)
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<ChatResponse> {
  const result = await chat(options);
  yield result;
}

/**
 * 사용 가능한 모델 목록 반환
 */
export function getAvailableModels(): GeminiModelInfo[] {
  return Object.values(GEMINI_MODELS);
}

/**
 * 모델 정보 가져오기
 */
export function getModelInfo(modelId: string): GeminiModelInfo | null {
  return GEMINI_MODELS[modelId] || null;
}

/**
 * 간단한 질문-응답
 */
export async function ask(prompt: string, options: Omit<ChatOptions, 'messages'> = {}): Promise<string> {
  const result = await chat({
    ...options,
    messages: [{ role: 'user', content: prompt }],
  });
  return result.content;
}

/**
 * 코드 탐색용 빠른 질문 (Gemini 3 Flash 사용)
 */
export async function quickAsk(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-3-flash',
    maxTokens: 2048,
    temperature: 0.3,
  });
}
