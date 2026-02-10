/**
 * Azure OpenAI Embedding API
 * 모델: text-embedding-3-large
 * 엔드포인트: fallingo-ai-foundry.cognitiveservices.azure.com
 */

import { getAuthInfo } from './auth.js';
import {
  AZ_EMBEDDING_BASE_URL,
  AZ_EMBEDDING_API_VERSION,
  AZ_EMBEDDING_MODEL,
} from '../az-constants.js';
import type { EmbeddingResponse } from './types.js';

const API_TIMEOUT_MS = 30_000;

interface AzureEmbeddingApiResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
}

/**
 * 텍스트 임베딩 생성 (Azure OpenAI text-embedding-3-large)
 * @param texts - 임베딩할 텍스트 배열
 * @param inputType - 'query' (검색 시) 또는 'passage' (인덱싱 시) — Azure에서는 미사용
 */
export async function embed(
  texts: string[],
  inputType: 'query' | 'passage' = 'query'
): Promise<EmbeddingResponse> {
  void inputType;
  const auth = await getAuthInfo();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const url = `${AZ_EMBEDDING_BASE_URL}/openai/deployments/${AZ_EMBEDDING_MODEL}/embeddings?api-version=${AZ_EMBEDDING_API_VERSION}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': auth.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Azure Embedding API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    const result = await response.json() as AzureEmbeddingApiResponse;
    return {
      embeddings: result.data.map(d => d.embedding),
      model: result.model,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Azure Embedding API timeout (${API_TIMEOUT_MS / 1000}s)`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
