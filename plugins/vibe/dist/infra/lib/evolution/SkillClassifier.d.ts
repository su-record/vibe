import { MemoryStorage } from '../memory/MemoryStorage.js';
export type SkillCategory = 'capability_uplift' | 'encoded_preference' | 'unknown';
export interface ClassificationResult {
    skillName: string;
    category: SkillCategory;
    confidence: number;
    reasoning: string;
    baselinePassRate: number;
    withSkillPassRate: number;
    trend: 'converging' | 'stable' | 'diverging' | 'insufficient_data';
    recommendation: string;
}
export declare class SkillClassifier {
    private benchmark;
    constructor(storage: MemoryStorage);
    /**
     * Classify a skill based on benchmark history
     */
    classify(skillName: string): ClassificationResult;
    /**
     * Classify based on explicit pass rates (no DB lookup)
     */
    classifyFromRates(skillName: string, withSkillPassRate: number, baselinePassRate: number, trend?: ClassificationResult['trend']): ClassificationResult;
    /**
     * Check if a skill is becoming obsolete (capability uplift that model now handles)
     */
    isBecomingObsolete(skillName: string): {
        obsolete: boolean;
        reason: string;
    };
    private determineCategory;
    private computeTrend;
    private pct;
}
//# sourceMappingURL=SkillClassifier.d.ts.map