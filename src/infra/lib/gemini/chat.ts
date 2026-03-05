/**
 * Gemini / Antigravity Chat API (generateContent)
 *
 * 라우팅:
 * - OAuth (antigravity/gemini-cli) → v1internal 엔드포인트 (Production 우선)
 * - API Key → Google AI Studio
 *
 * SSE 스트리밍 지원
 */

import { sleep } from '../utils.js';
import { getAuthInfo, getApiKeyFromConfig } from './auth.js';
import { getModelOverride } from '../config/GlobalConfigManager.js';
import {
  ENDPOINT_FALLBACKS,
  API_VERSION,
  ANTIGRAVITY_HEADERS,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './constants.js';
import type {
  GeminiModelInfo,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  GeminiApiResponse,
  V1InternalRequest,
} from './types.js';

// =============================================
// 모델 레지스트리
// =============================================

export function getGeminiModels(): Record<string, GeminiModelInfo> {
  const proId = getModelOverride('gemini') ?? process.env.GEMINI_MODEL ?? 'gemini-3.1-pro-preview';
  const flashId = getModelOverride('geminiFlash') ?? process.env.GEMINI_FLASH_MODEL ?? 'gemini-3.1-flash-lite-preview';
  const oauthProId = getModelOverride('geminiOauth') ?? process.env.GEMINI_OAUTH_MODEL ?? proId.replace(/-preview$/, '');
  const oauthFlashId = getModelOverride('geminiOauthFlash') ?? process.env.GEMINI_OAUTH_FLASH_MODEL ?? flashId.replace(/-preview$/, '');

  return {
    'gemini-pro': {
      id: proId,
      oauthId: oauthProId,
      name: 'Gemini Pro',
      description: 'Pro model for complex tasks',
      maxTokens: 8192,
    },
    'gemini-flash': {
      id: flashId,
      oauthId: oauthFlashId,
      name: 'Gemini Flash',
      description: 'Flash model, fastest',
      maxTokens: 8192,
    },
  };
}

/** @deprecated getGeminiModels() 사용 권장 */
export const GEMINI_MODELS = getGeminiModels();

export const DEFAULT_MODEL = 'gemini-flash';

// =============================================
// v1internal 요청 래핑
// =============================================

function wrapRequest(
  body: unknown,
  projectId: string,
  modelId: string,
): V1InternalRequest {
  return {
    project: projectId,
    model: modelId,
    request: body,
  };
}

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

  const models = getGeminiModels();
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

    const result = await response.json() as GeminiApiResponse;
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('Gemini API response is empty.');
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
// OAuth 방식 (v1internal — Production 우선)
// =============================================

async function chatWithOAuth(
  accessToken: string,
  projectId: string | undefined,
  options: ChatOptions,
): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
    webSearch = false,
    jsonMode = false,
  } = options;

  const models = getGeminiModels();
  const modelInfo = models[model] || models[DEFAULT_MODEL];
  const effectiveModelId = modelInfo.oauthId || modelInfo.id;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.min(maxTokens, modelInfo.maxTokens),
    temperature,
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const innerRequest: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemPrompt) {
    innerRequest.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  if (webSearch) {
    innerRequest.tools = [{ googleSearch: {} }];
  }

  const requestBody = wrapRequest(innerRequest, projectId || '', effectiveModelId);

  // Claude thinking 모델용 헤더
  const isClaudeModel = effectiveModelId.startsWith('claude-');
  const isThinkingModel = effectiveModelId.includes('thinking');

  let lastError: Error | null = null;

  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${API_VERSION}:generateContent`;
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

        // 404 → 다음 엔드포인트 시도
        if (response.status === 404) {
          lastError = new Error(`API not found: ${errorText}`);
          continue;
        }
        // 429 → 재시도
        if (response.status === 429) {
          const retryCount = options._retryCount || 0;
          if (retryCount < MAX_RETRIES) {
            await sleep(Math.pow(2, retryCount) * RETRY_BASE_DELAY_MS);
            return chatWithOAuth(accessToken, projectId, {
              ...options,
              _retryCount: retryCount + 1,
            });
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
      return {
        content: candidate.content?.parts?.[0]?.text || '',
        model: modelInfo.name,
        finishReason: candidate.finishReason,
        usage: responseData.usageMetadata,
      };
    } catch (error) {
      lastError = error as Error;
      const msg = (error as Error).message || '';
      if ((error as Error).name === 'TypeError' || msg.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('All endpoints failed');
}

// =============================================
// SSE 스트리밍 (v1internal)
// =============================================

async function* streamWithOAuth(
  accessToken: string,
  projectId: string | undefined,
  options: ChatOptions,
): AsyncGenerator<StreamChunk> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
    webSearch = false,
    jsonMode = false,
  } = options;

  const models = getGeminiModels();
  const modelInfo = models[model] || models[DEFAULT_MODEL];
  const effectiveModelId = modelInfo.oauthId || modelInfo.id;

  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: Math.min(maxTokens, modelInfo.maxTokens),
    temperature,
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const innerRequest: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemPrompt) {
    innerRequest.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  if (webSearch) {
    innerRequest.tools = [{ googleSearch: {} }];
  }

  const requestBody = wrapRequest(innerRequest, projectId || '', effectiveModelId);

  const isClaudeModel = effectiveModelId.startsWith('claude-');
  const isThinkingModel = effectiveModelId.includes('thinking');

  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${API_VERSION}:streamGenerateContent?alt=sse`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
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
        if (response.status === 404 || response.status === 429 || response.status === 503) {
          continue;
        }
        throw new Error(`Gemini streaming error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr) as GeminiApiResponse;
            const responseData = chunk.response || chunk;
            const candidate = responseData.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text || '';
            const finishReason = candidate?.finishReason;

            yield {
              content: text,
              done: finishReason === 'STOP',
              model: modelInfo.name,
              finishReason,
              usage: responseData.usageMetadata,
            };
          } catch {
            // 파싱 실패 무시
          }
        }
      }

      // 마지막 버퍼 처리
      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const chunk = JSON.parse(jsonStr) as GeminiApiResponse;
            const responseData = chunk.response || chunk;
            const candidate = responseData.candidates?.[0];
            yield {
              content: candidate?.content?.parts?.[0]?.text || '',
              done: true,
              model: modelInfo.name,
              finishReason: candidate?.finishReason,
              usage: responseData.usageMetadata,
            };
          } catch {
            // ignore
          }
        }
      }

      return;
    } catch (error) {
      const msg = (error as Error).message || '';
      if ((error as Error).name === 'TypeError' || msg.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('All streaming endpoints failed');
}

// =============================================
// Public API
// =============================================

/**
 * Gemini API 호출 (OAuth / API Key 자동 선택 + Fallback)
 *
 * 라우팅:
 * - antigravity/gemini-cli → v1internal (Production 우선)
 * - apikey → Google AI Studio
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const authInfo = await getAuthInfo();
  const apiKey = getApiKeyFromConfig();

  // API Key 방식
  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    return chatWithApiKey(authInfo.apiKey, options);
  }

  // OAuth 방식 (antigravity / gemini-cli)
  if (authInfo.accessToken) {
    const requestedModel = options.model || DEFAULT_MODEL;

    try {
      return await chatWithOAuth(authInfo.accessToken, authInfo.projectId, options);
    } catch (error) {
      const errorMsg = (error as Error).message;
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('503') || errorMsg.includes('capacity');
      const isNotFound = errorMsg.includes('404') || errorMsg.includes('not found');
      const isAuthError = errorMsg.includes('401') || errorMsg.includes('403');

      // 모델 fallback: pro → flash
      if (isRateLimit && requestedModel !== 'gemini-flash') {
        try {
          return await chatWithOAuth(
            authInfo.accessToken, authInfo.projectId,
            { ...options, model: 'gemini-flash' },
          );
        } catch (flashError) {
          if (apiKey) return chatWithApiKey(apiKey, options);
          throw flashError;
        }
      }

      // API Key fallback
      if ((isRateLimit || isNotFound || isAuthError) && apiKey) {
        return chatWithApiKey(apiKey, options);
      }
      throw error;
    }
  }

  throw new Error('Gemini credentials not found.');
}

/**
 * SSE 스트리밍 Chat
 * OAuth Pro → OAuth Flash → API Key (단일 yield) fallback
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const authInfo = await getAuthInfo();
  const apiKey = getApiKeyFromConfig();

  if (authInfo.accessToken) {
    const requestedModel = options.model || DEFAULT_MODEL;

    try {
      yield* streamWithOAuth(authInfo.accessToken, authInfo.projectId, options);
      return;
    } catch (error) {
      const errorMsg = (error as Error).message;
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('503');
      const isAuthError = errorMsg.includes('401') || errorMsg.includes('403');

      // Pro → Flash fallback (streaming)
      if (isRateLimit && requestedModel !== 'gemini-flash') {
        try {
          yield* streamWithOAuth(
            authInfo.accessToken, authInfo.projectId,
            { ...options, model: 'gemini-flash' },
          );
          return;
        } catch {
          // Flash도 실패 → API Key fallback
        }
      }

      // API Key fallback (단일 yield)
      if ((isRateLimit || isAuthError) && apiKey) {
        const result = await chatWithApiKey(apiKey, options);
        yield {
          content: result.content,
          done: true,
          model: result.model,
          finishReason: result.finishReason,
          usage: result.usage,
        };
        return;
      }
      throw error;
    }
  }

  // OAuth 없으면 API Key
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
export function getAvailableModels(): GeminiModelInfo[] {
  return Object.values(getGeminiModels());
}

/**
 * 모델 정보 가져오기
 */
export function getModelInfo(modelId: string): GeminiModelInfo | null {
  return getGeminiModels()[modelId] || null;
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
 * 코드 탐색용 빠른 질문 (Gemini Flash)
 */
export async function quickAsk(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-flash',
    maxTokens: 2048,
    temperature: 0.3,
  });
}
