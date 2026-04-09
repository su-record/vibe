/**
 * CostAccumulator — JSONL 비용 로그 조회 및 프로젝트별 예산 관리
 * hooks/scripts/utils.js의 logLlmCost()가 기록한 ~/.vibe/llm-costs.jsonl을 읽는다.
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

// ============================================================================
// CostAccumulator
// ============================================================================

export class CostAccumulator {
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
