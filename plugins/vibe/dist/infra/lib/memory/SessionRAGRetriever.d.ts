import { MemoryStorage } from './MemoryStorage.js';
import { SessionRAGStore, Decision, Constraint, Goal, Evidence } from './SessionRAGStore.js';
export interface RetrievalOptions {
    query: string;
    sessionId?: string;
    limit?: number;
    recencyWeight?: number;
    priorityWeight?: number;
    bm25Weight?: number;
    vectorWeight?: number;
    taskContext?: import('../TaskContext.js').TaskContextData;
}
export interface ScoreBreakdown {
    bm25: number;
    recency: number;
    priority: number;
    vector: number;
}
export interface ScoredItem<T> {
    item: T;
    score: number;
    breakdown: ScoreBreakdown;
}
export interface SessionRAGResult {
    decisions: ScoredItem<Decision>[];
    constraints: ScoredItem<Constraint>[];
    goals: ScoredItem<Goal>[];
    evidence: ScoredItem<Evidence>[];
    queryTime: number;
}
export declare class SessionRAGRetriever {
    private db;
    private store;
    private storage;
    private fts5Available;
    constructor(storage: MemoryStorage, store: SessionRAGStore);
    /**
     * Retrieve relevant session context with hybrid scoring (sync — backward compatible)
     * BM25 + Recency + Priority only
     */
    retrieve(options: RetrievalOptions): SessionRAGResult;
    /**
     * Retrieve with vector support (async)
     * 벡터 사용 가능 시: Vector + BM25 + Recency + Priority
     * 벡터 불가 시: BM25 + Recency + Priority (기존 동작)
     */
    retrieveAsync(options: RetrievalOptions): Promise<SessionRAGResult>;
    /**
     * 동기 retrieve (벡터 없이 — 기존 동작)
     */
    private retrieveSync;
    /**
     * 비동기 retrieve (벡터 포함)
     */
    private retrieveWithVector;
    /**
     * 벡터 스코어 맵 생성
     */
    private getVectorScores;
    /**
     * Retrieve only active goals and high-severity constraints (for session start injection)
     */
    retrieveActiveContext(): {
        goals: Goal[];
        constraints: Constraint[];
        decisions: Decision[];
    };
    private scoreDecisions;
    private scoreConstraints;
    private scoreGoals;
    private scoreEvidence;
    private getCandidateDecisions;
    private getCandidateConstraints;
    private getCandidateGoals;
    private getCandidateEvidence;
    private getBM25Scores;
    /**
     * Normalize BM25 score to 0-1 range.
     * BM25 returns negative values where more negative = better match.
     * We convert to 0-1 where 1 = best match.
     */
    private normalizeBM25;
    /**
     * Calculate recency score with exponential decay.
     * Returns 0-1 where 1 = just now, 0.5 = half-life ago.
     */
    private calculateRecency;
}
//# sourceMappingURL=SessionRAGRetriever.d.ts.map