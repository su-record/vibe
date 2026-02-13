/**
 * Embedding 타입 정의
 * 벡터 검색 + 하이브리드 스코어링에 사용
 */

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
}

export type EmbeddingProviderType = 'az' | 'gpt';

export interface EmbeddingProviderConfig {
  priority: EmbeddingProviderType[];
  dimensions: number;
}

export interface VectorSearchResult {
  key: string;
  similarity: number;
}

export interface SessionVectorSearchResult {
  entityType: string;
  entityId: number;
  similarity: number;
}

/** 256차원 축소 (text-embedding-3-large 기본 3072 → 256) */
export const DEFAULT_EMBEDDING_DIMENSIONS = 256;

/** 임베딩 API 타임아웃 (ms) */
export const EMBEDDING_API_TIMEOUT_MS = 30_000;

/** AZ Embedding 엔드포인트 */
export const AZ_EMBEDDING_BASE_URL = 'https://fallingo-ai-foundry.cognitiveservices.azure.com';
export const AZ_EMBEDDING_MODEL = 'text-embedding-3-large';
export const AZ_EMBEDDING_API_VERSION = '2024-06-01';

/** GPT Embedding 엔드포인트 */
export const GPT_EMBEDDING_BASE_URL = 'https://api.openai.com/v1';
export const GPT_EMBEDDING_MODEL = 'text-embedding-3-large';
