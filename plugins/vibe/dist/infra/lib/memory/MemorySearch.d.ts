import { MemoryItem, MemoryStorage } from './MemoryStorage.js';
import { KnowledgeGraph } from './KnowledgeGraph.js';
export type SearchStrategy = 'keyword' | 'fulltext' | 'graph_traversal' | 'temporal' | 'priority' | 'context_aware' | 'vector' | 'hybrid';
export interface SearchOptions {
    limit?: number;
    category?: string;
    includeRelations?: boolean;
    startKey?: string;
    depth?: number;
}
export declare class MemorySearch {
    private db;
    private storage;
    private graph;
    constructor(storage: MemoryStorage, graph: KnowledgeGraph);
    /**
     * Advanced search with multiple strategies (sync — backward compatible)
     * vector/hybrid 전략은 context_aware로 fallback (동기)
     */
    searchAdvanced(query: string, strategy: SearchStrategy, options?: SearchOptions): MemoryItem[];
    /**
     * Advanced search with vector support (async)
     * vector/hybrid 전략에서 실제 벡터 검색 수행
     */
    searchAdvancedAsync(query: string, strategy: SearchStrategy, options?: SearchOptions): Promise<MemoryItem[]>;
    private searchKeyword;
    private searchFulltext;
    private searchKeywordLike;
    private searchTemporal;
    private searchByPriority;
    private searchContextAware;
    /**
     * 순수 벡터 유사도 검색
     * 벡터 불가 시 BM25 fallback
     */
    private searchVector;
    /**
     * 하이브리드 검색: Vector + BM25 + Priority
     * 벡터 불가 시 context_aware fallback
     */
    private searchHybrid;
    /**
     * BM25 스코어 맵 생성 (정규화: 0~1)
     */
    private getBM25MemoryScores;
    /**
     * 메모리 priority 정규화 (0~1)
     */
    private getMemoryPriority;
    /**
     * 여러 키의 priority를 한 번의 쿼리로 일괄 조회 (N+1 방지)
     */
    private getMemoryPriorities;
    /**
     * 키 배열로 MemoryItem[] 조회 (순서 유지)
     */
    private resolveMemoryItems;
}
//# sourceMappingURL=MemorySearch.d.ts.map