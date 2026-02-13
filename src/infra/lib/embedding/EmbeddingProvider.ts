/**
 * EmbeddingProvider — AZ/GPT 임베딩 API 통합 클라이언트
 *
 * priority 순서대로 프로바이더 시도, 실패 시 fallback.
 * API 키 없으면 isAvailable() = false → graceful degradation.
 */

import type {
  EmbeddingResponse,
  EmbeddingProviderType,
  EmbeddingProviderConfig,
} from './types.js';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  EMBEDDING_API_TIMEOUT_MS,
  AZ_EMBEDDING_BASE_URL,
  AZ_EMBEDDING_MODEL,
  AZ_EMBEDDING_API_VERSION,
  GPT_EMBEDDING_BASE_URL,
  GPT_EMBEDDING_MODEL,
} from './types.js';

export class EmbeddingProvider {
  private config: EmbeddingProviderConfig;

  constructor(config?: Partial<EmbeddingProviderConfig>) {
    this.config = {
      priority: config?.priority ?? ['az', 'gpt'],
      dimensions: config?.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
    };
  }

  /**
   * API 키가 설정된 프로바이더가 하나라도 있는지 확인
   */
  public isAvailable(): boolean {
    return this.config.priority.some(p => this.hasApiKey(p));
  }

  /**
   * 텍스트 배열을 임베딩 벡터로 변환
   * priority 순서대로 시도, 첫 성공 반환
   */
  public async embed(texts: string[]): Promise<EmbeddingResponse> {
    if (texts.length === 0) {
      return { embeddings: [], model: '' };
    }

    const errors: Error[] = [];

    for (const provider of this.config.priority) {
      if (!this.hasApiKey(provider)) continue;

      try {
        return await this.callProvider(provider, texts);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new Error(
      `All embedding providers failed: ${errors.map(e => e.message).join('; ')}`,
    );
  }

  private hasApiKey(provider: EmbeddingProviderType): boolean {
    switch (provider) {
      case 'az':
        return Boolean(process.env.AZ_API_KEY);
      case 'gpt':
        return Boolean(process.env.OPENAI_API_KEY);
      default:
        return false;
    }
  }

  private async callProvider(
    provider: EmbeddingProviderType,
    texts: string[],
  ): Promise<EmbeddingResponse> {
    switch (provider) {
      case 'az':
        return this.callAzEmbedding(texts);
      case 'gpt':
        return this.callGptEmbedding(texts);
      default:
        throw new Error(`Unknown embedding provider: ${provider}`);
    }
  }

  private async callAzEmbedding(texts: string[]): Promise<EmbeddingResponse> {
    const apiKey = process.env.AZ_API_KEY;
    if (!apiKey) throw new Error('AZ_API_KEY not set');

    const url = `${AZ_EMBEDDING_BASE_URL}/openai/deployments/${AZ_EMBEDDING_MODEL}/embeddings?api-version=${AZ_EMBEDDING_API_VERSION}`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      EMBEDDING_API_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: texts,
          dimensions: this.config.dimensions,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `AZ Embedding API error (${response.status})`;
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
        throw new Error(`AZ Embedding API timeout (${EMBEDDING_API_TIMEOUT_MS / 1000}s)`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callGptEmbedding(texts: string[]): Promise<EmbeddingResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
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
