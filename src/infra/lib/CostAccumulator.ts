/**
 * CostAccumulator — JSONL 비용 로그 조회/기록 및 프로젝트별 예산 관리
 * ~/.vibe/llm-costs.jsonl 을 읽고(조회/예산) 쓴다(logCost).
 * hooks/scripts/utils.js 의 logLlmCost() 와 동일 포맷·경로를 공유한다 — hook CLI 호출과
 * TS 직접 provider 호출이 같은 원장에 집계되어 cost telemetry 과소집계를 막는다 (B-8).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface CostEntry {
  ts: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  cached: boolean;
  project: string;
}

export interface CostSummary {
  totalCost: number;
  totalEntries: number;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  period: { from: string | null; to: string | null };
}

export interface BudgetConfig {
  monthlyLlmUsd: number;
  alertThresholdPercent: number;
  blockingThresholdPercent: number;
}

export interface BudgetCheck {
  allowed: boolean;
  currentSpend: number;
  budget: number;
  usagePercent: number;
  level: 'ok' | 'alert' | 'blocking';
}

// ============================================================================
// Constants
// ============================================================================

const COST_LOG_PATH = path.join(os.homedir(), '.vibe', 'llm-costs.jsonl');
const COST_LOG_PREV = COST_LOG_PATH + '.prev';

const DEFAULT_BUDGET: BudgetConfig = {
  monthlyLlmUsd: 0, // 0 = unlimited
  alertThresholdPercent: 80,
  blockingThresholdPercent: 95,
};

const MAX_COST_SIZE_BYTES = 5 * 1024 * 1024; // 5MB rotation (JS logLlmCost 와 동일)

// 1K 토큰당 USD (추정치) — hooks/scripts/utils.js 의 COST_PER_1K_TOKENS 와 동기 유지
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-5.5': { input: 0.005, output: 0.030 },
  'gpt-5.5-pro': { input: 0.030, output: 0.180 },
  'gpt-5.3-codex': { input: 0.003, output: 0.010 },
  'gpt-5.3-codex-spark': { input: 0.001, output: 0.005 },
  'gemini-3.1-pro-preview': { input: 0.00125, output: 0.005 },
};
const DEFAULT_RATE = { input: 0.003, output: 0.010 };

// ============================================================================
// CostAccumulator
// ============================================================================

export class CostAccumulator {
  /**
   * TS 직접 provider 호출의 비용/지표를 JS logLlmCost 와 동일 포맷으로 기록한다 (B-8).
   * 실패가 호출을 방해하지 않도록 모든 오류를 삼킨다.
   */
  static logCost(opts: {
    provider: string;
    model: string;
    inputLen: number;
    outputLen: number;
    durationMs: number;
    cached?: boolean;
    project?: string;
    usedFallback?: boolean;
    retries?: number;
  }): void {
    try {
      // 5MB 초과 시 rotation (JS 와 동일)
      if (fs.existsSync(COST_LOG_PATH)) {
        const stat = fs.statSync(COST_LOG_PATH);
        if (stat.size > MAX_COST_SIZE_BYTES) {
          try { fs.unlinkSync(COST_LOG_PREV); } catch { /* ignore */ }
          fs.renameSync(COST_LOG_PATH, COST_LOG_PREV);
        }
      } else {
        fs.mkdirSync(path.dirname(COST_LOG_PATH), { recursive: true });
      }

      // 문자 수 → 토큰 추정 (평균 3자/토큰), JS 와 동일
      const inputTokens = Math.ceil(opts.inputLen / 3);
      const outputTokens = Math.ceil(opts.outputLen / 3);
      const rates = COST_PER_1K_TOKENS[opts.model] || DEFAULT_RATE;
      const cost = opts.cached
        ? 0
        : (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;

      const entry: Record<string, unknown> = {
        ts: new Date().toISOString(),
        provider: opts.provider,
        model: opts.model,
        inputTokens,
        outputTokens,
        cost: Math.round(cost * 1_000_000) / 1_000_000,
        durationMs: opts.durationMs,
        cached: !!opts.cached,
        project: opts.project ?? process.cwd(),
      };
      if (opts.usedFallback !== undefined) entry.usedFallback = opts.usedFallback;
      if (opts.retries !== undefined) entry.retries = opts.retries;

      fs.appendFileSync(COST_LOG_PATH, JSON.stringify(entry) + '\n');
    } catch { /* telemetry 실패가 호출을 방해해선 안 됨 */ }
  }

  /**
   * 프로젝트별 비용 조회
   */
  static queryProjectCosts(
    projectPath: string,
    filter?: { since?: Date; model?: string; provider?: string },
  ): CostSummary {
    const entries = CostAccumulator.readEntries();
    const filtered = entries.filter((e) => {
      if (e.project !== projectPath) return false;
      if (filter?.since && new Date(e.ts) < filter.since) return false;
      if (filter?.model && e.model !== filter.model) return false;
      if (filter?.provider && e.provider !== filter.provider) return false;
      return true;
    });
    return CostAccumulator.summarize(filtered);
  }

  /**
   * 전체 비용 프로젝트별 집계
   */
  static queryAllCosts(since?: Date): Map<string, number> {
    const entries = CostAccumulator.readEntries();
    const result = new Map<string, number>();
    for (const e of entries) {
      if (since && new Date(e.ts) < since) continue;
      const current = result.get(e.project) || 0;
      result.set(e.project, current + e.cost);
    }
    return result;
  }

  /**
   * 이번 달 프로젝트 비용 vs 예산 확인
   */
  static checkBudget(
    projectPath: string,
    budget?: Partial<BudgetConfig>,
  ): BudgetCheck {
    const cfg = { ...DEFAULT_BUDGET, ...budget };
    if (cfg.monthlyLlmUsd <= 0) {
      return { allowed: true, currentSpend: 0, budget: 0, usagePercent: 0, level: 'ok' };
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const summary = CostAccumulator.queryProjectCosts(projectPath, { since: monthStart });
    const usagePercent = (summary.totalCost / cfg.monthlyLlmUsd) * 100;

    let level: BudgetCheck['level'] = 'ok';
    if (usagePercent >= cfg.blockingThresholdPercent) level = 'blocking';
    else if (usagePercent >= cfg.alertThresholdPercent) level = 'alert';

    return {
      allowed: level !== 'blocking',
      currentSpend: Math.round(summary.totalCost * 10000) / 10000,
      budget: cfg.monthlyLlmUsd,
      usagePercent: Math.round(usagePercent * 100) / 100,
      level,
    };
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private static readEntries(): CostEntry[] {
    const entries: CostEntry[] = [];
    for (const filepath of [COST_LOG_PREV, COST_LOG_PATH]) {
      if (!fs.existsSync(filepath)) continue;
      try {
        const content = fs.readFileSync(filepath, 'utf-8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            entries.push(JSON.parse(line) as CostEntry);
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // skip unreadable files
      }
    }
    return entries;
  }

  private static summarize(entries: CostEntry[]): CostSummary {
    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let totalCost = 0;
    let from: string | null = null;
    let to: string | null = null;

    for (const e of entries) {
      totalCost += e.cost;
      byModel[e.model] = (byModel[e.model] || 0) + e.cost;
      byProvider[e.provider] = (byProvider[e.provider] || 0) + e.cost;
      if (!from || e.ts < from) from = e.ts;
      if (!to || e.ts > to) to = e.ts;
    }

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalEntries: entries.length,
      byModel,
      byProvider,
      period: { from, to },
    };
  }
}
