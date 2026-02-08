/**
 * GPT Embedding API (OpenAI Direct)
 * 모델: text-embedding-3-large
 * 엔드포인트: api.openai.com/v1/embeddings
 *
 * 주의: API Key 인증만 지원 (OAuth 토큰은 임베딩에 사용 불가)
 */

import { getApiKeyFromConfig } from './auth.js';
import type { EmbeddingResponse } from './types.js';

const API_TIMEOUT_MS = 30_000;
const GPT_EMBEDDING_BASE_URL = 'https://api.openai.com/v1';
const GPT_EMBEDDING_MODEL = 'text-embedding-3-large';

interface OpenAIEmbeddingApiResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
}

/**
 * API Key 가져오기 (환경변수 → 저장 파일)
 * OAuth는 임베딩에 사용 불가하므로 API Key만 확인
 */
function getEmbeddingApiKey(): string {
  // 1. 환경변수 확인
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;

  // 2. 저장된 API Key 확인
  const storedKey = getApiKeyFromConfig();
  if (storedKey) return storedKey;

  throw new Error(
    'GPT Embedding requires API Key. OAuth is not supported for embeddings. ' +
    'Run "vibe gpt key <api-key>" or set OPENAI_API_KEY env variable.'
  );
}

/**
 * 텍스트 임베딩 생성 (OpenAI text-embedding-3-large)
 * @param texts - 임베딩할 텍스트 배열
 * @param inputType - 'query' (검색 시) 또는 'passage' (인덱싱 시) — OpenAI에서는 미사용
 */
export async function embed(
  texts: string[],
  inputType: 'query' | 'passage' = 'query'
): Promise<EmbeddingResponse> {
  void inputType;
  const apiKey = getEmbeddingApiKey();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${GPT_EMBEDDING_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: GPT_EMBEDDING_MODEL,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `GPT Embedding API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }
      throw new Error(errorMessage);
    }

    const result = await response.json() as OpenAIEmbeddingApiResponse;
    return {
      embeddings: result.data.map(d => d.embedding),
      model: result.model,
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`GPT Embedding API timeout (${API_TIMEOUT_MS / 1000}s)`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
