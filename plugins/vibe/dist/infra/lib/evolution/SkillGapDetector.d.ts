import { MemoryStorage } from '../memory/MemoryStorage.js';
export declare class SkillGapDetector {
    private db;
    private insightStore;
    constructor(storage: MemoryStorage);
    /**
     * Log a prompt-dispatcher miss
     */
    logMiss(prompt: string, sessionId?: string): void;
    /**
     * Analyze accumulated gaps and generate skill_gap insights
     */
    analyze(limit?: number): {
        newGaps: string[];
        totalClusters: number;
    };
    /**
     * Get gap log count
     */
    getGapCount(): number;
}
//# sourceMappingURL=SkillGapDetector.d.ts.map