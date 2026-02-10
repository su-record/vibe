// Session RAG Retriever - Hybrid search with BM25 + metadata scoring
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
}

export interface ScoreBreakdown {
  bm25: number;
  recency: number;
  priority: number;
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
const RECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// SessionRAGRetriever
// ============================================================================

export class SessionRAGRetriever {
  private db: Database.Database;
  private store: SessionRAGStore;
  private fts5Available: boolean;

  constructor(storage: MemoryStorage, store: SessionRAGStore) {
    this.db = storage.getDatabase();
    this.store = store;
    this.fts5Available = storage.isFTS5Available();
  }

  /**
   * Retrieve relevant session context with hybrid scoring
   */
  public retrieve(options: RetrievalOptions): SessionRAGResult {
    const startTime = Date.now();
    const {
      query,
      limit = DEFAULT_LIMIT,
      recencyWeight = DEFAULT_RECENCY_WEIGHT,
      priorityWeight = DEFAULT_PRIORITY_WEIGHT,
      bm25Weight = DEFAULT_BM25_WEIGHT,
    } = options;

    const weights = { bm25Weight, recencyWeight, priorityWeight };

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
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number },
  ): ScoredItem<Decision>[] {
    const bm25Scores = this.getBM25Scores('session_decisions', 'session_decisions_fts', query, limit * 3);
    const candidates = this.getCandidateDecisions(query, bm25Scores, limit * 3);

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = item.priority / 2; // normalize 0-2 → 0-1

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight;

        return { item, score, breakdown: { bm25, recency, priority } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreConstraints(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number },
  ): ScoredItem<Constraint>[] {
    const bm25Scores = this.getBM25Scores('session_constraints', 'session_constraints_fts', query, limit * 3);
    const candidates = this.getCandidateConstraints(query, bm25Scores, limit * 3);

    const severityMap: Record<string, number> = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = severityMap[item.severity] ?? 0.5;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight;

        return { item, score, breakdown: { bm25, recency, priority } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreGoals(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number },
  ): ScoredItem<Goal>[] {
    const bm25Scores = this.getBM25Scores('session_goals', 'session_goals_fts', query, limit * 3);
    const candidates = this.getCandidateGoals(query, bm25Scores, limit * 3);

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = item.priority / 2;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight;

        return { item, score, breakdown: { bm25, recency, priority } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreEvidence(
    query: string,
    limit: number,
    weights: { bm25Weight: number; recencyWeight: number; priorityWeight: number },
  ): ScoredItem<Evidence>[] {
    const bm25Scores = this.getBM25Scores('session_evidence', 'session_evidence_fts', query, limit * 3);
    const candidates = this.getCandidateEvidence(query, bm25Scores, limit * 3);

    const statusMap: Record<string, number> = { fail: 1.0, warning: 0.75, pass: 0.5, info: 0.25 };

    return candidates
      .map(item => {
        const bm25 = this.normalizeBM25(bm25Scores.get(item.id) ?? 0);
        const recency = this.calculateRecency(item.timestamp);
        const priority = statusMap[item.status] ?? 0.5;

        const score =
          bm25 * weights.bm25Weight +
          recency * weights.recencyWeight +
          priority * weights.priorityWeight;

        return { item, score, breakdown: { bm25, recency, priority } };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ==========================================================================
  // Candidate retrieval (FTS5 or LIKE fallback)
  // ==========================================================================

  private getCandidateDecisions(query: string, bm25Scores: Map<number, number>, limit: number): Decision[] {
    if (bm25Scores.size > 0) {
      return this.store.searchDecisions(query, limit);
    }
    // No BM25 results, get all recent ones for scoring
    return this.store.listDecisions(undefined, undefined, limit);
  }

  private getCandidateConstraints(query: string, bm25Scores: Map<number, number>, limit: number): Constraint[] {
    if (bm25Scores.size > 0) {
      return this.store.searchConstraints(query, limit);
    }
    return this.store.listConstraints(undefined, undefined, undefined, limit);
  }

  private getCandidateGoals(query: string, bm25Scores: Map<number, number>, limit: number): Goal[] {
    if (bm25Scores.size > 0) {
      return this.store.searchGoals(query, limit);
    }
    return this.store.listGoals(undefined, undefined, limit);
  }

  private getCandidateEvidence(query: string, bm25Scores: Map<number, number>, limit: number): Evidence[] {
    if (bm25Scores.size > 0) {
      return this.store.searchEvidence(query, limit);
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
      `).all(query, limit) as Array<{ id: number; rank: number }>;

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
