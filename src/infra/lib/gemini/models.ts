/**
 * Gemini Model Discovery API
 *
 * Google AI Studio (API Key) 전용
 */

import { getApiKeyFromConfig } from './auth.js';
import type { AvailableModel } from './types.js';

/**
 * Google AI Studio 응답 타입
 */
interface GoogleAIModel {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
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
 * 사용 가능한 모델 목록 조회 (API Key)
 */
export async function fetchAvailableModels(): Promise<AvailableModel[]> {
  const apiKey = getApiKeyFromConfig();
  if (!apiKey) {
    throw new Error('Gemini API key required. Run "vibe gemini key <key>".');
  }

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
