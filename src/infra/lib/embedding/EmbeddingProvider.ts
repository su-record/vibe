/**
 * EmbeddingProvider — GPT 임베딩 API 클라이언트
 *
 * API 키 없으면 isAvailable() = false → graceful degradation.
 */

import type {
  EmbeddingResponse,
  EmbeddingProviderConfig,
} from './types.js';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  EMBEDDING_API_TIMEOUT_MS,
  GPT_EMBEDDING_BASE_URL,
  GPT_EMBEDDING_MODEL,
} from './types.js';
import { getGptApiKey } from '../config/GlobalConfigManager.js';

export class EmbeddingProvider {
  private config: EmbeddingProviderConfig;

  constructor(config?: Partial<EmbeddingProviderConfig>) {
    this.config = {
      priority: config?.priority ?? ['gpt'],
      dimensions: config?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
    };
  }

  /**
   * API 키가 설정되어 있는지 확인
   */
  public isAvailable(): boolean {
    return Boolean(getGptApiKey() || process.env.OPENAI_API_KEY);
  }

  /**
   * 텍스트 배열을 임베딩 벡터로 변환
   */
  public async embed(texts: string[]): Promise<EmbeddingResponse> {
    if (texts.length === 0) {
      return { embeddings: [], model: '' };
    }

    if (!this.isAvailable()) {
      throw new Error(
        'All embedding providers failed: OPENAI_API_KEY not set',
      );
    }

    return this.callGptEmbedding(texts);
  }

  private async callGptEmbedding(texts: string[]): Promise<EmbeddingResponse> {
    const apiKey = getGptApiKey() || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      EMBEDDING_API_TIMEOUT_MS,
    );

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
          dimensions: this.config.dimensions,
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
        } catch { /* ignore parse error */ }
        throw new Error(errorMessage);
      }

      const result = await response.json() as {
        data: Array<{ embedding: number[] }>;
        model: string;
      };

      return {
        embeddings: result.data.map(d => d.embedding),
        model: result.model,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`GPT Embedding API timeout (${EMBEDDING_API_TIMEOUT_MS / 1000}s)`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
