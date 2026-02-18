/**
 * Gemini / Antigravity Code Completion API (completeCode)
 *
 * v1internal:completeCode 엔드포인트
 * Production → Autopush → Daily 순서
 */

import { sleep } from '../utils.js';
import { getAuthInfo } from './auth.js';
import {
  ENDPOINT_FALLBACKS,
  API_VERSION,
  ANTIGRAVITY_HEADERS,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './constants.js';
import { getGeminiModels, DEFAULT_MODEL } from './chat.js';
import type { CompleteCodeOptions, CompleteCodeResponse } from './types.js';

interface CompleteCodeApiResponse {
  response?: {
    completions?: Array<{ text?: string; completion?: string }>;
  };
  completions?: Array<{ text?: string; completion?: string }>;
}

/**
 * v1internal:completeCode 호출
 */
async function completeCodeWithOAuth(
  accessToken: string,
  projectId: string | undefined,
  options: CompleteCodeOptions,
): Promise<CompleteCodeResponse> {
  const {
    prefix,
    suffix = '',
    language = 'typescript',
    maxTokens = 256,
    model = DEFAULT_MODEL,
  } = options;

  const models = getGeminiModels();
  const modelInfo = models[model] || models[DEFAULT_MODEL];
  const effectiveModelId = modelInfo.oauthId || modelInfo.id;

  const innerRequest = {
    prefix,
    suffix,
    language,
    maxCompletionTokens: maxTokens,
  };

  const requestBody = {
    project: projectId || '',
    model: effectiveModelId,
    request: innerRequest,
  };

  let lastError: Error | null = null;

  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${API_VERSION}:completeCode`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...ANTIGRAVITY_HEADERS,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 404) {
          lastError = new Error(`completeCode not found: ${errorText}`);
          continue;
        }

        if (response.status === 429) {
          const retryCount = options._retryCount || 0;
          if (retryCount < MAX_RETRIES) {
            await sleep(Math.pow(2, retryCount) * RETRY_BASE_DELAY_MS);
            return completeCodeWithOAuth(accessToken, projectId, {
              ...options,
              _retryCount: retryCount + 1,
            });
          }
        }

        throw new Error(`completeCode error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as CompleteCodeApiResponse;
      const responseData = result.response || result;
      const completionItems = responseData.completions || [];

      const completions = completionItems
        .map(item => item.text || item.completion || '')
        .filter(Boolean);

      return {
        completions,
        model: modelInfo.name,
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

  throw lastError || new Error('All completeCode endpoints failed');
}

/**
 * 코드 자동완성 (OAuth 전용)
 *
 * @example
 * ```ts
 * const result = await completeCode({
 *   prefix: 'function hello() {\n  console.',
 *   suffix: '\n}',
 *   language: 'typescript',
 * });
 * // result.completions: ['log("Hello, World!");', ...]
 * ```
 */
export async function completeCode(
  options: CompleteCodeOptions,
): Promise<CompleteCodeResponse> {
  const authInfo = await getAuthInfo();

  if (!authInfo.accessToken) {
    throw new Error('completeCode requires OAuth authentication. API Key not supported.');
  }

  return completeCodeWithOAuth(authInfo.accessToken, authInfo.projectId, options);
}
