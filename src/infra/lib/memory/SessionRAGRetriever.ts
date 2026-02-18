// Session RAG Retriever - Hybrid search with BM25 + Vector + metadata scoring
// Retrieves relevant session context (decisions/constraints/goals/evidence)

import Database from 'better-sqlite3';
import { MemoryStorage } from './MemoryStorage.js';
import {
  SessionRAGStore,
  Decision,
  Constraint,
  Goal,
  Evidence,
} from './SessionRAGStore.js';
import type { VectorStore } from '../embedding/VectorStore.js';
import type { EmbeddingProvider } from '../embedding/EmbeddingProvider.js';

// ============================================================================
// Types
// ============================================================================

export interface RetrievalOptions {
  query: string;
  sessionId?: string;
  limit?: number;
  recencyWeight?: number;
  priorityWeight?: number;
  bm25Weight?: number;
  vectorWeight?: number;
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

const DEFAULT_LIMIT = 5;
const DEFAULT_BM25_WEIGHT = 0.4;
const DEFAULT_RECENCY_WEIGHT = 0.3;
const DEFAULT_PRIORITY_WEIGHT = 0.3;
const DEFAULT_VECTOR_WEIGHT = 0.25;
const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Entity type → FTS table mapping
const ENTITY_TYPE_MAP: Record<string, string> = {
  decisions: 'session_decisions',
  constraints: 'session_constraints',
  goals: 'session_goals',
  evidence: 'session_evidence',
};

// ============================================================================
// SessionRAGRetriever
// ============================================================================

export class SessionRAGRetriever {
  private db: Database.Database;
  private store: SessionRAGStore;
  private storage: MemoryStorage;
  private fts5Available: boolean;

  constructor(storage: MemoryStorage, store: SessionRAGStore) {
    this.db = storage.getDatabase();
    this.store = store;
    this.storage = storage;
    this.fts5Available = storage.isFTS5Available();
  }

  /**
   * Retrieve relevant session context with hybrid scoring (sync — backward compatible)
   * BM25 + Recency + Priority only
   */
  public retrieve(options: RetrievalOptions): SessionRAGResult {
    return this.retrieveSync(options);
  }

  /**
   * Retrieve with vector support (async)
   * 벡터 사용 가능 시: Vector + BM25 + Recency + Priority
   * 벡터 불가 시: BM25 + Recency + Priority (기존 동작)
   */
  public async retrieveAsync(options: RetrievalOptions): Promise<SessionRAGResult> {
    const vectorAvailable = this.storage.isVectorAvailable();

    if (vectorAvailable && options.vectorWeight !== 0) {
      return this.retrieveWithVector(options);
    }

    return this.retrieveSync(options);
  }

  /**
   * 동기 retrieve (벡터 없이 — 기존 동작)
   */
  private retrieveSync(options: RetrievalOptions): SessionRAGResult {
    const startTime = Date.now();
    const {
      query,
      limit = DEFAULT_LIMIT,
      recencyWeight = DEFAULT_RECENCY_WEIGHT,
      priorityWeight = DEFAULT_PRIORITY_WEIGHT,
      bm25Weight = DEFAULT_BM25_WEIGHT,
    } = options;

    const weights = { bm25Weight, recencyWeight, priorityWeight, vectorWeight: 0 };

    const decisions = this.scoreDecisions(query, limit, weights);
    const constraints = this.scoreConstraints(query, limit, weights);
    const goals = this.scoreGoals(query, limit, weights);
    const evidence = this.scoreEvidence(query, limit, weights);

    return {
      decisions,
      constraints,
      goals,
      evidence,
      queryTime: Date.now() - startTime,
    };
  }

  /**
   * 비동기 retrieve (벡터 포함)
   */
  private async retrieveWithVector(options: RetrievalOptions): Promise<SessionRAGResult> {
    const startTime = Date.now();
    const {
      query,
      limit = DEFAULT_LIMIT,
      vectorWeight = DEFAULT_VECTOR_WEIGHT,
    } = options;

    // 벡터 포함 시 가중치 재분배: vector(0.25) + bm25(0.25) + recency(0.25) + priority(0.25)
    const remaining = 1 - vectorWeight;
    const bm25Weight = (options.bm25Weight ?? DEFAULT_BM25_WEIGHT) * (remaining / (1 - 0));
    const recencyWeight = (options.recencyWeight ?? DEFAULT_RECENCY_WEIGHT) * (remaining / (1 - 0));
    const priorityWeight = (options.priorityWeight ?? DEFAULT_PRIORITY_WEIGHT) * (remaining / (1 - 0));

    // Normalize so all weights sum to 1
    const totalW = vectorWeight + bm25Weight + recencyWeight + priorityWeight;
    const weights = {
      vectorWeight: vectorWeight / totalW,
      bm25Weight: bm25Weight / totalW,
      recencyWeight: recencyWeight / totalW,
      priorityWeight: priorityWeight / totalW,
    };

    // 쿼리 임베딩 생성
    let queryEmbedding: number[] | null = null;
    const provider = this.storage.getEmbeddingProvider();
    if (provider) {
      try {
        const embResult = await provider.embed([query]);
        if (embResult.embeddings.length > 0) {
          queryEmbedding = embResult.embeddings[0];
        }
      } catch {
        // 임베딩 실패 → 벡터 없이 진행
      }
    }

    // 벡터 스코어 맵 (entityType → entityId → similarity)
    const vectorScores = this.getVectorScores(queryEmbedding);
    const effectiveWeights = queryEmbedding ? weights : {
      vectorWeight: 0,
      bm25Weight: DEFAULT_BM25_WEIGHT,
      recencyWeight: DEFAULT_RECENCY_WEIGHT,
      priorityWeight: DEFAULT_PRIORITY_WEIGHT,
    };

    const decisions = this.scoreDecisions(query, limit, effectiveWeights, vectorScores.get('decisions'));
    const constraints = this.scoreConstraints(query, limit, effectiveWeights, vectorScores.get('constraints'));
    const goals = this.scoreGoals(query, limit, effectiveWeights, vectorScores.get('goals'));
    const evidence = this.scoreEvidence(query, limit, effectiveWeights, vectorScores.get('evidence'));

    return {
      decisions,
      constraints,
      goals,
      evidence,
      queryTime: Date.now() - startTime,
    };
  }

  /**
   * 벡터 스코어 맵 생성
   */
  private getVectorScores(
    queryEmbedding: number[] | null,
  ): Map<string, Map<number, number>> {
    const result = new Map<string, Map<number, number>>();

    if (!queryEmbedding) return result;

    const vectorStore = this.storage.getVectorStore();
    if (!vectorStore) return result;

    for (const entityType of ['decisions', 'constraints', 'goals', 'evidence']) {
      const scores = new Map<number, number>();
      const results = vectorStore.searchSessionVectors(entityType, queryEmbedding, 50);
      for (const r of results) {
        scores.set(r.entityId, r.similarity);
      }
      result.set(entityType, scores);
    }

    return result;
  }

  /**
   * Retrieve only active goals and high-severity constraints (for session start injection)
   */
  public retrieveActiveContext(): {
    goals: Goal[];
    constraints: Constraint[];
    decisions: Decision[];
  } {
    return {
      goals: this.store.getActiveGoals(5),
      constraints: this.store.listConstraints(undefined, undefined, undefined, 10)
        .filter(c => c.severity === 'critical' || c.severity === 'high'),
      decisions: this.store.listDecisions(undefined, 'active', 5),
    };
  }

  // ==========================================================================
  // Scoring per entity type
  // ==========================================================================

  private scoreDecisions(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number; vectorWeight: number },
    vectorScores?: Map<number, number>,
  ): ScoredItem<Decision>[] {
    const bm25Scores = this.getBM25Scores('session_decisions', 'session_decisions_fts', query, limit * 3);
    const candidates = this.getCandidateDecisions(query, bm25Scores, limit * 3);

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = item.priority / 2;
        const vector = vectorScores?.get(item.id) ?? 0;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight +
          vector * weights.vectorWeight;

        return { item, score, breakdown: { bm25, recency, priority, vector } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreConstraints(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number; vectorWeight: number },
    vectorScores?: Map<number, number>,
  ): ScoredItem<Constraint>[] {
    const bm25Scores = this.getBM25Scores('session_constraints', 'session_constraints_fts', query, limit * 3);
    const candidates = this.getCandidateConstraints(query, bm25Scores, limit * 3);

    const severityMap: Record<string, number> = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = severityMap[item.severity] ?? 0.5;
        const vector = vectorScores?.get(item.id) ?? 0;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight +
          vector * weights.vectorWeight;

        return { item, score, breakdown: { bm25, recency, priority, vector } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreGoals(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number; vectorWeight: number },
    vectorScores?: Map<number, number>,
  ): ScoredItem<Goal>[] {
    const bm25Scores = this.getBM25Scores('session_goals', 'session_goals_fts', query, limit * 3);
    const candidates = this.getCandidateGoals(query, bm25Scores, limit * 3);

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = item.priority / 2;
        const vector = vectorScores?.get(item.id) ?? 0;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight +
          vector * weights.vectorWeight;

        return { item, score, breakdown: { bm25, recency, priority, vector } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreEvidence(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number; vectorWeight: number },
    vectorScores?: Map<number, number>,
  ): ScoredItem<Evidence>[] {
    const bm25Scores = this.getBM25Scores('session_evidence', 'session_evidence_fts', query, limit * 3);
    const candidates = this.getCandidateEvidence(query, bm25Scores, limit * 3);

    const statusMap: Record<string, number> = { fail: 1.0, warning: 0.75, pass: 0.5, info: 0.25 };

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = statusMap[item.status] ?? 0.5;
        const vector = vectorScores?.get(item.id) ?? 0;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight +
          vector * weights.vectorWeight;

        return { item, score, breakdown: { bm25, recency, priority, vector } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ==========================================================================
  // Candidate retrieval (FTS5 or LIKE fallback)
  // ==========================================================================

  private getCandidateDecisions(_query: string, bm25Scores: Map<number, number>, limit: number): Decision[] {
    if (bm25Scores.size > 0) {
      // Use IDs from bm25Scores directly to avoid duplicate FTS query
      const ids = [...bm25Scores.keys()].slice(0, limit);
      return ids
        .map(id => this.store.getDecision(id))
        .filter((d): d is Decision => d !== null);
    }
    // No BM25 results, get all recent ones for scoring
    return this.store.listDecisions(undefined, undefined, limit);
  }

  private getCandidateConstraints(_query: string, bm25Scores: Map<number, number>, limit: number): Constraint[] {
    if (bm25Scores.size > 0) {
      // Use IDs from bm25Scores directly to avoid duplicate FTS query
      const ids = [...bm25Scores.keys()].slice(0, limit);
      return ids
        .map(id => this.store.getConstraint(id))
        .filter((c): c is Constraint => c !== null);
    }
    return this.store.listConstraints(undefined, undefined, undefined, limit);
  }

  private getCandidateGoals(_query: string, bm25Scores: Map<number, number>, limit: number): Goal[] {
    if (bm25Scores.size > 0) {
      // Use IDs from bm25Scores directly to avoid duplicate FTS query
      const ids = [...bm25Scores.keys()].slice(0, limit);
      return ids
        .map(id => this.store.getGoal(id))
        .filter((g): g is Goal => g !== null);
    }
    return this.store.listGoals(undefined, undefined, limit);
  }

  private getCandidateEvidence(_query: string, bm25Scores: Map<number, number>, limit: number): Evidence[] {
    if (bm25Scores.size > 0) {
      // Use IDs from bm25Scores directly to avoid duplicate FTS query
      const ids = [...bm25Scores.keys()].slice(0, limit);
      return ids
        .map(id => this.store.getEvidence(id))
        .filter((e): e is Evidence => e !== null);
    }
    return this.store.listEvidence(undefined, undefined, undefined, limit);
  }

  // ==========================================================================
  // BM25 scoring helpers
  // ==========================================================================

  private getBM25Scores(table: string, ftsTable: string, query: string, limit: number): Map<number, number> {
    const scores = new Map<number, number>();

    if (!this.fts5Available) return scores;

    try {
      const rows = this.db.prepare(`
        SELECT t.id, bm25(${ftsTable}) as rank
        FROM ${ftsTable} fts
        JOIN ${table} t ON t.id = fts.rowid
        WHERE ${ftsTable} MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(MemoryStorage.sanitizeFTS5Query(query), limit) as Array<{ id: number; rank: number }>;

      for (const row of rows) {
        scores.set(row.id, row.rank);
      }
    } catch {
      // FTS5 query failed
    }

    return scores;
  }

  /**
   * Normalize BM25 score to 0-1 range.
   * BM25 returns negative values where more negative = better match.
   * We convert to 0-1 where 1 = best match.
   */
  private normalizeBM25(rawScore: number): number {
    if (rawScore === 0) return 0;
    // BM25 returns negative scores; -20 is a strong match, 0 is no match
    // Clamp to [-20, 0] then normalize
    const clamped = Math.max(rawScore, -20);
    return Math.abs(clamped) / 20;
  }

  /**
   * Calculate recency score with exponential decay.
   * Returns 0-1 where 1 = just now, 0.5 = half-life ago.
   */
  private calculateRecency(timestamp: string): number {
    const age = Date.now() - new Date(timestamp).getTime();
    if (age <= 0) return 1;
    return Math.exp(-age * Math.LN2 / RECENCY_HALF_LIFE_MS);
  }
}
