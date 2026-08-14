/**
 * VectorStore — SQLite 기반 벡터 저장소
 *
 * 메모리/세션 엔티티의 임베딩 벡터를 BLOB으로 저장.
 * 검색: 행 단위 iterate → 코사인 유사도 → 스트리밍 top-k 선택.
 * (메모리 수 천~만 건 수준이므로 인덱스 없는 선형 스캔으로 충분하나,
 *  전량 적재+전체 정렬은 피해 메모리 O(limit)·정렬 비용 제거)
 */
import Database from 'better-sqlite3';
import type { VectorSearchResult, SessionVectorSearchResult } from './types.js';
export declare class VectorStore {
    private db;
    constructor(db: Database.Database);
    private initializeTables;
    /**
     * 메모리 벡터 저장 (upsert)
     */
    saveMemoryVector(key: string, embedding: number[]): void;
    /**
     * 세션 엔티티 벡터 저장 (upsert)
     */
    saveSessionVector(entityType: string, entityId: number, embedding: number[]): void;
    /**
     * 메모리 벡터 삭제
     */
    deleteMemoryVector(key: string): void;
    /**
     * 세션 엔티티 벡터 삭제
     */
    deleteSessionVector(entityType: string, entityId: number): void;
    /**
     * 스트리밍 top-k 선택 — 전 행을 배열로 적재해 전체 정렬(O(V log V) + O(V) 메모리)
     * 하는 대신, iterate()로 한 행씩 스코어링하며 크기 limit의 정렬 배열만 유지한다.
     * limit은 통상 ≤20이므로 선형 삽입으로 충분 (O(V·limit), 메모리 O(limit)).
     */
    private static topKBySimilarity;
    /**
     * 메모리 벡터 코사인 유사도 검색
     */
    searchMemoryVectors(queryVec: number[], limit?: number): VectorSearchResult[];
    /**
     * 세션 엔티티 벡터 코사인 유사도 검색
     */
    searchSessionVectors(entityType: string, queryVec: number[], limit?: number): SessionVectorSearchResult[];
    /**
     * 저장된 메모리 벡터 수
     */
    getMemoryVectorCount(): number;
    /**
     * 저장된 세션 벡터 수
     */
    getSessionVectorCount(entityType?: string): number;
}
//# sourceMappingURL=VectorStore.d.ts.map