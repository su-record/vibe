/**
 * CostAccumulator — JSONL 비용 로그 조회/기록 및 프로젝트별 예산 관리
 * ~/.vibe/llm-costs.jsonl 을 읽고(조회/예산) 쓴다(logCost).
 * hooks/scripts/utils.js 의 logLlmCost() 와 동일 포맷·경로를 공유한다 — hook CLI 호출과
 * TS 직접 provider 호출이 같은 원장에 집계되어 cost telemetry 과소집계를 막는다 (B-8).
 */
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
    period: {
        from: string | null;
        to: string | null;
    };
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
export declare class CostAccumulator {
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
    }): void;
    /**
     * 프로젝트별 비용 조회
     */
    static queryProjectCosts(projectPath: string, filter?: {
        since?: Date;
        model?: string;
        provider?: string;
    }): CostSummary;
    /**
     * 전체 비용 프로젝트별 집계
     */
    static queryAllCosts(since?: Date): Map<string, number>;
    /**
     * 이번 달 프로젝트 비용 vs 예산 확인
     */
    static checkBudget(projectPath: string, budget?: Partial<BudgetConfig>): BudgetCheck;
    private static readEntries;
    private static summarize;
}
//# sourceMappingURL=CostAccumulator.d.ts.map