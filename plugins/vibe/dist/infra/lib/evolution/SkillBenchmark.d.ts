import { MemoryStorage } from '../memory/MemoryStorage.js';
export interface BenchmarkResult {
    id: string;
    skillName: string;
    iteration: number;
    timestamp: string;
    summary: BenchmarkSummary;
    evalBreakdowns: EvalBreakdown[];
}
export interface BenchmarkSummary {
    totalEvals: number;
    withSkill: VariantStats;
    baseline: VariantStats;
    delta: DeltaStats;
}
export interface VariantStats {
    passRate: number;
    meanDurationMs: number;
    stddevDurationMs: number;
    meanTokens: number;
    stddevTokens: number;
    totalRuns: number;
}
export interface DeltaStats {
    passRateDelta: number;
    durationDeltaMs: number;
    tokenDelta: number;
}
export interface EvalBreakdown {
    evalId: string;
    prompt: string;
    withSkillPassed: boolean;
    baselinePassed: boolean;
    withSkillDurationMs: number;
    baselineDurationMs: number;
    withSkillTokens: number;
    baselineTokens: number;
    assertionResults: Array<{
        description: string;
        withSkillPassed: boolean;
        baselinePassed: boolean;
    }>;
}
export declare class SkillBenchmark {
    private db;
    private evalRunner;
    constructor(storage: MemoryStorage);
    private initializeTables;
    /**
     * Aggregate latest eval runs into a benchmark
     */
    aggregate(skillName: string): BenchmarkResult;
    /**
     * Get benchmark history for a skill
     */
    getHistory(skillName: string): BenchmarkResult[];
    /**
     * Get the latest benchmark for a skill
     */
    getLatest(skillName: string): BenchmarkResult | null;
    /**
     * Compare two benchmark iterations
     */
    compare(skillName: string, iterA: number, iterB: number): {
        iterationA: BenchmarkResult | null;
        iterationB: BenchmarkResult | null;
        improvement: DeltaStats | null;
    };
    /**
     * Format benchmark as markdown report
     */
    formatReport(benchmark: BenchmarkResult): string;
    private getBenchmarkByIteration;
    private getNextIteration;
    private computeVariantStats;
    private mergeAssertionResults;
    private pct;
    private signedPct;
    private rowToBenchmark;
}
//# sourceMappingURL=SkillBenchmark.d.ts.map