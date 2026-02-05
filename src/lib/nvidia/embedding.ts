/**
 * NVIDIA NIM Embedding API
 * 모델: nvidia/llama-3.2-nv-embedqa-1b-v2
 * 26개 언어 지원, 8K 토큰
 */

import { getAuthInfo } from './auth.js';
import { NVIDIA_BASE_URL, NVIDIA_MODEL_MAP } from '../nvidia-constants.js';
import type { EmbeddingResponse } from './types.js';

const API_TIMEOUT_MS = 30_000;

interface NvidiaEmbeddingApiResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
}

/**
 * 텍스트 임베딩 생성
 * @param texts - 임베딩할 텍스트 배열
 * @param inputType - 'query' (검색 시) 또는 'passage' (인덱싱 시)
 */
export async function embed(
  texts: string[],
  inputType: 'query' | 'passage' = 'query'
): Promise<EmbeddingResponse> {
  const auth = await getAuthInfo();
  const model = NVIDIA_MODEL_MAP['nv-embed'];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: texts,
        input_type: inputType,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `NVIDIA NIM Embedding API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    const result = await response.json() as NvidiaEmbeddingApiResponse;
    return {
      embeddings: result.data.map(d => d.embedding),
      model: result.model,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`NVIDIA NIM Embedding API timeout (${API_TIMEOUT_MS / 1000}s)`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
