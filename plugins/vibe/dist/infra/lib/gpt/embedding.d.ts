/**
 * GPT Embedding API (OpenAI Direct)
 * 모델: text-embedding-3-large
 * 엔드포인트: api.openai.com/v1/embeddings
 *
 * 주의: API Key 인증만 지원
 */
import type { EmbeddingResponse } from './types.js';
/**
 * 텍스트 임베딩 생성 (OpenAI text-embedding-3-large)
 * @param texts - 임베딩할 텍스트 배열
 * @param inputType - 'query' (검색 시) 또는 'passage' (인덱싱 시) — OpenAI에서는 미사용
 */
export declare function embed(texts: string[], inputType?: 'query' | 'passage'): Promise<EmbeddingResponse>;
//# sourceMappingURL=embedding.d.ts.map