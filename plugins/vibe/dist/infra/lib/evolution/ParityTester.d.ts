import { MemoryStorage } from '../memory/MemoryStorage.js';
export interface ModelVersion {
    id: string;
    name: string;
    registeredAt: string;
}
export interface ParityTestResult {
    id: string;
    skillName: string;
    oldModel: string;
    newModel: string;
    /** Old model's baseline pass rate */
    oldBaselinePassRate: number;
    /** New model's baseline pass rate (without skill) */
    newBaselinePassRate: number;
    /** With-skill pass rate (reference) */
    withSkillPassRate: number;
    /** Parity score: how close new baseline is to with-skill (0-1, 1=identical) */
    parityScore: number;
    /** Whether the skill is becoming obsolete */
    obsoleteCandidate: boolean;
    /** Detailed per-eval comparison */
    evalComparisons: EvalComparison[];
    timestamp: string;
}
export interface EvalComparison {
    evalId: string;
    prompt: string;
    oldBaselinePassed: boolean;
    newBaselinePassed: boolean;
    withSkillPassed: boolean;
    /** Did new model baseline improve over old? */
    improved: boolean;
}
export declare const PARITY_THRESHOLDS: {
    /** New baseline >= this fraction of with-skill → obsolete candidate */
    readonly OBSOLESCENCE_RATIO: 0.85;
    /** Minimum improvement in baseline to consider significant */
    readonly MIN_IMPROVEMENT: 0.1;
    /** Minimum eval cases for reliable parity test */
    readonly MIN_EVAL_CASES: 3;
};
export declare class ParityTester {
    private db;
    constructor(storage: MemoryStorage);
    private initializeTables;
    /** Register a model version */
    registerModel(id: string, name: string): ModelVersion;
    /** Get all registered models */
    getModels(): ModelVersion[];
    /** Record baseline eval results for a specific model */
    recordModelBaseline(skillName: string, modelId: string, evalResults: Array<{
        evalId: string;
        passed: boolean;
        output: string;
        durationMs: number;
        tokenCount: number;
        prompt?: string;
    }>): void;
    /**
     * Run a parity test by reading existing baseline data from model_baseline_results.
     * with-skill reference data is also read from model_baseline_results with variant 'with_skill'.
     */
    runParityTest(skillName: string, oldModel: string, newModel: string): ParityTestResult;
    /** Get parity test history for a skill */
    getHistory(skillName: string): ParityTestResult[];
    /** Get latest parity test */
    getLatest(skillName: string): ParityTestResult | null;
    /** Format parity test as markdown report */
    formatReport(result: ParityTestResult): string;
    private getBaselineRows;
    private buildComparisons;
}
//# sourceMappingURL=ParityTester.d.ts.map