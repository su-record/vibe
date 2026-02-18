/**
 * Embedding 모듈 — 벡터 검색 인프라
 */

export { EmbeddingProvider } from './EmbeddingProvider.js';
export { VectorStore } from './VectorStore.js';
export { cosineSimilarity, serializeVector, deserializeVector } from './cosine.js';
export type {
  EmbeddingResponse,
  EmbeddingProviderType,
  EmbeddingProviderConfig,
  VectorSearchResult,
  SessionVectorSearchResult,
} from './types.js';
export { DEFAULT_EMBEDDING_DIMENSIONS } from './types.js';
