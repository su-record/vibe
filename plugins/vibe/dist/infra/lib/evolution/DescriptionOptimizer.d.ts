import { MemoryStorage } from '../memory/MemoryStorage.js';
export interface TriggerEvalQuery {
    query: string;
    shouldTrigger: boolean;
}
export interface TriggerEvalResult {
    query: string;
    shouldTrigger: boolean;
    didTrigger: boolean;
    triggerRate: number;
    correct: boolean;
}
export interface DescriptionCandidate {
    description: string;
    trainScore: number;
    testScore: number;
    iteration: number;
    results: TriggerEvalResult[];
}
export interface OptimizationRun {
    id: string;
    skillName: string;
    originalDescription: string;
    bestDescription: string;
    candidates: DescriptionCandidate[];
    trainQueries: TriggerEvalQuery[];
    testQueries: TriggerEvalQuery[];
    improvement: number;
    createdAt: string;
}
export declare class DescriptionOptimizer {
    private db;
    constructor(storage: MemoryStorage);
    private initializeTables;
    /**
     * Split eval queries into train/test sets (60/40)
     */
    splitEvalSet(queries: TriggerEvalQuery[]): {
        train: TriggerEvalQuery[];
        test: TriggerEvalQuery[];
    };
    /**
     * Evaluate a description against a set of trigger queries.
     * Uses keyword matching as a proxy for actual skill triggering.
     * In production, this would call `claude -p` and monitor the stream.
     */
    evaluateDescription(description: string, queries: TriggerEvalQuery[]): TriggerEvalResult[];
    /**
     * Score a set of evaluation results (accuracy)
     */
    scoreResults(results: TriggerEvalResult[]): number;
    /**
     * Run a single optimization iteration:
     * Evaluate current description, improve based on failures
     */
    evaluateCandidate(description: string, trainQueries: TriggerEvalQuery[], testQueries: TriggerEvalQuery[], iteration: number): DescriptionCandidate;
    /**
     * Suggest an improved description based on failed eval queries.
     * Analyzes what failed and adds/removes keywords to improve accuracy.
     */
    suggestImprovement(currentDescription: string, failedResults: TriggerEvalResult[]): string;
    /**
     * Run the full optimization loop
     */
    optimize(skillName: string, description: string, queries: TriggerEvalQuery[], maxIterations?: number): OptimizationRun;
    /**
     * Get optimization history for a skill
     */
    getHistory(skillName: string): OptimizationRun[];
    /**
     * Get latest optimization for a skill
     */
    getLatest(skillName: string): OptimizationRun | null;
    /**
     * Generate a 20-query trigger validation eval set for a skill.
     * Follows Harness pattern: 10 should-trigger + 10 should-NOT-trigger.
     *
     * Should-trigger queries cover:
     * - Diverse phrasing of the same intent (formal/casual)
     * - Implicit need (no explicit skill mention)
     * - Edge use cases
     *
     * Should-NOT-trigger queries focus on near-misses:
     * - Similar keywords but different intent
     * - Adjacent domains
     * - Ambiguous phrasing that belongs to a different skill
     */
    generateTriggerEvalSet(skillName: string, description: string, existingSkillDescriptions?: Map<string, string>): TriggerEvalQuery[];
    /**
     * Validate trigger accuracy for a skill against its 20-query eval set.
     * Returns accuracy score and details of failures.
     */
    validateTriggers(skillName: string, description: string, queries?: TriggerEvalQuery[], existingSkillDescriptions?: Map<string, string>): {
        accuracy: number;
        falsePositives: TriggerEvalResult[];
        falseNegatives: TriggerEvalResult[];
        results: TriggerEvalResult[];
    };
    /**
     * Check for trigger collisions between a new skill and existing skills.
     * Returns skills whose trigger queries would incorrectly fire for the new skill's description.
     */
    checkCollisions(skillName: string, description: string, existingSkills: Map<string, string>): Array<{
        collidingSkill: string;
        overlapScore: number;
        sharedKeywords: string[];
    }>;
    /**
     * Batch validate all skills' trigger accuracy.
     * Returns a report of skills with low accuracy that need description improvement.
     */
    batchValidate(skills: Map<string, string>, accuracyThreshold?: number): Array<{
        skillName: string;
        accuracy: number;
        falsePositiveCount: number;
        falseNegativeCount: number;
        needsImprovement: boolean;
    }>;
    private extractKeywords;
    private computeOverlap;
    private takePortion;
    private rowToRun;
}
//# sourceMappingURL=DescriptionOptimizer.d.ts.map