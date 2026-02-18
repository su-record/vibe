/**
 * Gemini / Antigravity Model Discovery API
 *
 * v1internal:fetchAvailableModels 엔드포인트
 * Production → Autopush → Daily 순서
 */

import { getAuthInfo } from './auth.js';
import {
  ENDPOINT_FALLBACKS,
  API_VERSION,
  ANTIGRAVITY_HEADERS,
} from './constants.js';
import type { AvailableModel } from './types.js';

/**
 * v1internal 응답: models가 객체(맵) 형태
 * { "models": { "model-id": { displayName, maxTokens, ... }, ... } }
 */
interface V1InternalModelDetail {
  displayName?: string;
  supportsImages?: boolean;
  supportsThinking?: boolean;
  thinkingBudget?: number;
  recommended?: boolean;
  maxTokens?: number;
  maxOutputTokens?: number;
  model?: string;
  apiProvider?: string;
  modelProvider?: string;
  quotaInfo?: {
    remainingFraction?: number;
    resetTime?: string;
  };
  supportedMimeTypes?: Record<string, boolean>;
}

interface V1InternalModelsResponse {
  models?: Record<string, V1InternalModelDetail>;
}

/**
 * Google AI Studio 응답: models가 배열 형태
 * { "models": [ { name, displayName, ... }, ... ] }
 */
interface GoogleAIModel {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

function normalizeV1Internal(
  modelId: string,
  detail: V1InternalModelDetail,
): AvailableModel {
  return {
    modelId,
    displayName: detail.displayName || modelId,
    description: [
      detail.modelProvider,
      detail.supportsThinking ? 'thinking' : '',
      detail.supportsImages ? 'vision' : '',
    ].filter(Boolean).join(', '),
    inputTokenLimit: detail.maxTokens || 0,
    outputTokenLimit: detail.maxOutputTokens || 0,
    supportedActions: [],
  };
}

function normalizeGoogleAI(raw: GoogleAIModel): AvailableModel {
  return {
    modelId: raw.name || '',
    displayName: raw.displayName || raw.name || '',
    description: raw.description || '',
    inputTokenLimit: raw.inputTokenLimit || 0,
    outputTokenLimit: raw.outputTokenLimit || 0,
    supportedActions: raw.supportedGenerationMethods || [],
  };
}

/**
 * v1internal:fetchAvailableModels 호출
 */
async function fetchModelsWithOAuth(
  accessToken: string,
  projectId: string | undefined,
): Promise<AvailableModel[]> {
  const requestBody = {
    project: projectId || '',
  };

  let lastError: Error | null = null;

  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${API_VERSION}:fetchAvailableModels`;
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
        if (response.status === 404) {
          lastError = new Error('fetchAvailableModels not found');
          continue;
        }
        const errorText = await response.text();
        throw new Error(`fetchAvailableModels error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as V1InternalModelsResponse;
      const modelsMap = result.models;

      if (!modelsMap || typeof modelsMap !== 'object') {
        return [];
      }

      // 배열이면 legacy 처리, 객체면 v1internal 처리
      if (Array.isArray(modelsMap)) {
        return (modelsMap as GoogleAIModel[]).map(normalizeGoogleAI);
      }

      return Object.entries(modelsMap).map(
        ([id, detail]) => normalizeV1Internal(id, detail),
      );
    } catch (error) {
      lastError = error as Error;
      const msg = (error as Error).message || '';
      if ((error as Error).name === 'TypeError' || msg.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('All fetchAvailableModels endpoints failed');
}

/**
 * Google AI Studio 모델 목록 (API Key)
 */
async function fetchModelsWithApiKey(apiKey: string): Promise<AvailableModel[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google AI models API error (${response.status}): ${errorText}`);
  }

  const result = await response.json() as { models?: GoogleAIModel[] };
  const rawModels = result.models || [];

  return rawModels.map(normalizeGoogleAI);
}

/**
 * 사용 가능한 모델 목록 조회 (OAuth / API Key 자동 선택)
 */
export async function fetchAvailableModels(): Promise<AvailableModel[]> {
  const authInfo = await getAuthInfo();

  if (authInfo.accessToken) {
    return fetchModelsWithOAuth(authInfo.accessToken, authInfo.projectId);
  }

  if (authInfo.apiKey) {
    return fetchModelsWithApiKey(authInfo.apiKey);
  }

  throw new Error('Gemini credentials not found.');
}
