/**
 * TokenBudgetTracker - In-memory per-session token budget tracker
 * Singleton per project (same pattern as MemoryManager)
 * Provides predictive overflow prevention with threshold-based warnings
 */

import { TOKENS } from './constants.js';

// ============================================================================
// Types
// ============================================================================

export type TokenSource =
  | 'session_rag'
  | 'memory'
  | 'agent'
  | 'compression'
  | 'tool_call'
  | 'user_prompt'
  | 'system';

export type ThresholdLevel = 'none' | 'soft' | 'medium' | 'hard' | 'critical';

export interface BudgetSnapshot {
  totalBudget: number;
  consumed: number;
  remaining: number;
  usagePercent: number;
  level: ThresholdLevel;
  bySource: Record<TokenSource, number>;
  crossings: ThresholdCrossing[];
}

export interface ActionEstimate {
  action: string;
  estimatedTokens: number;
  wouldCrossThreshold: boolean;
  resultingLevel: ThresholdLevel;
  resultingPercent: number;
}

interface ThresholdCrossing {
  level: ThresholdLevel;
  crossedAt: number;
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const THRESHOLD_PERCENTS: Record<ThresholdLevel, number> = {
  none: 0,
  soft: 65,
  medium: 75,
  hard: 85,
  critical: 95,
};

const ORDERED_LEVELS: ThresholdLevel[] = [
  'none', 'soft', 'medium', 'hard', 'critical',
];

// ============================================================================
// TokenBudgetTracker
// ============================================================================

export type ThresholdCallback = (level: ThresholdLevel, snapshot: BudgetSnapshot) => void | Promise<void>;

export class TokenBudgetTracker {
  private static instances: Map<string, TokenBudgetTracker> = new Map();
  private static defaultInstance: TokenBudgetTracker | null = null;

  private totalBudget: number;
  private consumed: number;
  private bySource: Record<TokenSource, number>;
  private crossings: ThresholdCrossing[];
  private lastLevel: ThresholdLevel;
  private thresholdCallbacks: Map<ThresholdLevel, ThresholdCallback[]>;
  private circuitBreakerFailures: number;
  private static readonly MAX_CIRCUIT_FAILURES = 3;

  private constructor(totalBudget: number) {
    this.totalBudget = totalBudget;
    this.consumed = 0;
    this.bySource = this.createEmptySourceMap();
    this.crossings = [];
    this.lastLevel = 'none';
    this.thresholdCallbacks = new Map();
    this.circuitBreakerFailures = 0;
  }

  static getInstance(
    projectPath?: string,
    totalBudget: number = TOKENS.DEFAULT_BUDGET,
  ): TokenBudgetTracker {
    if (projectPath) {
      const existing = TokenBudgetTracker.instances.get(projectPath);
      if (existing) return existing;
      const inst = new TokenBudgetTracker(totalBudget);
      TokenBudgetTracker.instances.set(projectPath, inst);
      return inst;
    }
    if (!TokenBudgetTracker.defaultInstance) {
      TokenBudgetTracker.defaultInstance = new TokenBudgetTracker(totalBudget);
    }
    return TokenBudgetTracker.defaultInstance;
  }

  trackConsumption(source: TokenSource, tokens: number): ThresholdLevel {
    this.consumed += tokens;
    this.bySource[source] += tokens;
    const newLevel = this.getCurrentLevel();
    if (this.levelIndex(newLevel) > this.levelIndex(this.lastLevel)) {
      this.crossings.push({
        level: newLevel,
        crossedAt: this.consumed,
        timestamp: new Date().toISOString(),
      });
      // 자동 콜백 실행 (회로 차단기 적용)
      this.fireCallbacks(newLevel);
    }
    this.lastLevel = newLevel;
    return newLevel;
  }

  /**
   * 특정 threshold 도달 시 자동 실행할 콜백 등록.
   * 예: medium(75%) → 자동 압축, hard(85%) → 경고, critical(95%) → 중단
   */
  onThreshold(level: ThresholdLevel, callback: ThresholdCallback): void {
    const cbs = this.thresholdCallbacks.get(level) || [];
    cbs.push(callback);
    this.thresholdCallbacks.set(level, cbs);
  }

  /** 회로 차단기: 연속 실패 시 콜백 실행 중단 */
  isCircuitOpen(): boolean {
    return this.circuitBreakerFailures >= TokenBudgetTracker.MAX_CIRCUIT_FAILURES;
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerFailures = 0;
  }

  private fireCallbacks(level: ThresholdLevel): void {
    if (this.isCircuitOpen()) return;
    const callbacks = this.thresholdCallbacks.get(level);
    if (!callbacks?.length) return;
    const snapshot = this.getSnapshot();
    for (const cb of callbacks) {
      try {
        const result = cb(level, snapshot);
        if (result instanceof Promise) {
          result.catch(() => { this.circuitBreakerFailures++; });
        }
        this.circuitBreakerFailures = 0; // 성공 시 리셋
      } catch {
        this.circuitBreakerFailures++;
      }
    }
  }

  syncToPercent(percent: number): void {
    this.consumed = Math.round(this.totalBudget * (percent / 100));
    this.lastLevel = this.getCurrentLevel();
  }

  getRemainingBudget(): number {
    return Math.max(0, this.totalBudget - this.consumed);
  }

  getUsagePercent(): number {
    if (this.totalBudget === 0) return 100;
    return Math.min(100, (this.consumed / this.totalBudget) * 100);
  }

  estimateAfterAction(
    action: string,
    estimatedTokens: number,
  ): ActionEstimate {
    const projectedConsumed = this.consumed + estimatedTokens;
    const projectedPercent = Math.min(
      100,
      (projectedConsumed / this.totalBudget) * 100,
    );
    const projectedLevel = this.levelForPercent(projectedPercent);
    const wouldCross =
      this.levelIndex(projectedLevel) > this.levelIndex(this.lastLevel);

    return {
      action,
      estimatedTokens,
      wouldCrossThreshold: wouldCross,
      resultingLevel: projectedLevel,
      resultingPercent: Math.round(projectedPercent * 100) / 100,
    };
  }

  shouldThrottle(): boolean {
    return this.getUsagePercent() >= THRESHOLD_PERCENTS.medium;
  }

  getCurrentLevel(): ThresholdLevel {
    return this.levelForPercent(this.getUsagePercent());
  }

  getSnapshot(): BudgetSnapshot {
    return {
      totalBudget: this.totalBudget,
      consumed: this.consumed,
      remaining: this.getRemainingBudget(),
      usagePercent: Math.round(this.getUsagePercent() * 100) / 100,
      level: this.getCurrentLevel(),
      bySource: { ...this.bySource },
      crossings: [...this.crossings],
    };
  }

  static estimateTokens(text: string): number {
    return Math.ceil(text.length * TOKENS.PER_CHAR_ESTIMATE);
  }

  reset(): void {
    this.consumed = 0;
    this.bySource = this.createEmptySourceMap();
    this.crossings = [];
    this.lastLevel = 'none';
    this.circuitBreakerFailures = 0;
  }

  static resetInstance(): void {
    TokenBudgetTracker.instances.clear();
    TokenBudgetTracker.defaultInstance = null;
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  private createEmptySourceMap(): Record<TokenSource, number> {
    return {
      session_rag: 0,
      memory: 0,
      agent: 0,
      compression: 0,
      tool_call: 0,
      user_prompt: 0,
      system: 0,
    };
  }

  private levelForPercent(percent: number): ThresholdLevel {
    if (percent >= THRESHOLD_PERCENTS.critical) return 'critical';
    if (percent >= THRESHOLD_PERCENTS.hard) return 'hard';
    if (percent >= THRESHOLD_PERCENTS.medium) return 'medium';
    if (percent >= THRESHOLD_PERCENTS.soft) return 'soft';
    return 'none';
  }

  private levelIndex(level: ThresholdLevel): number {
    return ORDERED_LEVELS.indexOf(level);
  }
}
