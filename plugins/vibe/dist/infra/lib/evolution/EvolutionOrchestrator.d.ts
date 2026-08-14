import { MemoryStorage } from '../memory/MemoryStorage.js';
export interface OrchestrationResult {
    generated: string[];
    rejected: string[];
    errors: string[];
}
interface EvolutionConfig {
    mode: 'suggest' | 'auto';
    maxGenerationsPerCycle: number;
    minQualityScore: number;
}
export declare class EvolutionOrchestrator {
    private insightStore;
    private registry;
    private skillGen;
    private agentGen;
    private ruleGen;
    private collisionDetector;
    private config;
    constructor(storage: MemoryStorage, config?: Partial<EvolutionConfig>);
    /**
     * Run a full generation cycle
     */
    generate(): OrchestrationResult;
    private generateFromInsight;
    private saveGeneration;
    private calculateQualityScore;
    private enforceFileLimit;
    /**
     * Cleanup temporary files left from failed generations
     */
    cleanupTempFiles(): void;
}
export {};
//# sourceMappingURL=EvolutionOrchestrator.d.ts.map