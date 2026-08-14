/**
 * EmbeddingProvider — GPT 임베딩 API 클라이언트
 *
 * API 키 없으면 isAvailable() = false → graceful degradation.
 */
import type { EmbeddingResponse, EmbeddingProviderConfig } from './types.js';
export declare class EmbeddingProvider {
    private config;
    constructor(config?: Partial<EmbeddingProviderConfig>);
    /**
     * API 키가 설정되어 있는지 확인
     */
    isAvailable(): boolean;
    /**
     * 텍스트 배열을 임베딩 벡터로 변환
     */
    embed(texts: string[]): Promise<EmbeddingResponse>;
    private callGptEmbedding;
}
//# sourceMappingURL=EmbeddingProvider.d.ts.map