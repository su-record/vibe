import { MemoryStorage } from '../memory/MemoryStorage.js';
export type EvalStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';
export interface SkillEvalCase {
    id: string;
    skillName: string;
    prompt: string;
    expectedOutput: string;
    files: string[];
    assertions: EvalAssertion[];
}
export interface EvalAssertion {
    id: string;
    description: string;
    type: 'contains' | 'not_contains' | 'matches_regex' | 'custom';
    value: string;
}
export interface EvalRunResult {
    evalId: string;
    runId: string;
    skillName: string;
    variant: 'with_skill' | 'baseline';
    status: EvalStatus;
    output: string;
    grades: AssertionGrade[];
    durationMs: number;
    tokenCount: number;
    createdAt: string;
}
export interface AssertionGrade {
    assertionId: string;
    description: string;
    passed: boolean;
    evidence: string;
}
export interface EvalSetInput {
    skillName: string;
    evals: Array<{
        prompt: string;
        expectedOutput: string;
        files?: string[];
        assertions?: Array<{
            description: string;
            type: 'contains' | 'not_contains' | 'matches_regex' | 'custom';
            value: string;
        }>;
    }>;
}
export declare class SkillEvalRunner {
    private db;
    constructor(storage: MemoryStorage);
    private initializeTables;
    /**
     * Create an eval set for a skill
     */
    createEvalSet(input: EvalSetInput): SkillEvalCase[];
    /**
     * Get all eval cases for a skill
     */
    getEvalCases(skillName: string): SkillEvalCase[];
    /**
     * Get a single eval case by ID
     */
    getEvalCase(evalId: string): SkillEvalCase | null;
    /**
     * Record the start of an eval run
     */
    startRun(evalId: string, skillName: string, variant: 'with_skill' | 'baseline'): string;
    /**
     * Complete an eval run with output and grades
     */
    completeRun(runId: string, output: string, grades: AssertionGrade[], durationMs: number, tokenCount: number): void;
    /**
     * Mark a run as errored
     */
    failRun(runId: string, errorMessage: string): void;
    /**
     * Grade output against assertions
     */
    gradeOutput(output: string, assertions: EvalAssertion[]): AssertionGrade[];
    /**
     * Get all runs for an eval case
     */
    getRunsForEval(evalId: string): EvalRunResult[];
    /**
     * Get all runs for a skill
     */
    getRunsForSkill(skillName: string): EvalRunResult[];
    /**
     * Get latest runs grouped by eval and variant
     */
    getLatestRuns(skillName: string): Map<string, {
        withSkill: EvalRunResult | null;
        baseline: EvalRunResult | null;
    }>;
    /**
     * Delete all eval cases and runs for a skill
     */
    deleteEvalSet(skillName: string): number;
    private rowToEvalCase;
    private rowToRunResult;
}
//# sourceMappingURL=SkillEvalRunner.d.ts.map