import { MemoryStorage } from '../memory/MemoryStorage.js';
interface ExtractionResult {
    newInsights: string[];
    mergedInsights: string[];
    skippedCount: number;
    errorCount: number;
}
export declare class InsightExtractor {
    private reflectionStore;
    private observationStore;
    private insightStore;
    constructor(storage: MemoryStorage);
    /**
     * Extract insights from recent reflections and observations
     * @param limit Max items to process (default 50)
     */
    extractFromRecent(limit?: number): ExtractionResult;
    private processReflectionTopics;
    private processObservationTopics;
    private classifyTopic;
    private extractTags;
}
export {};
//# sourceMappingURL=InsightExtractor.d.ts.map