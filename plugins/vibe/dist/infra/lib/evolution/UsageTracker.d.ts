import { MemoryStorage } from '../memory/MemoryStorage.js';
export type FeedbackType = 'positive' | 'negative' | 'neutral';
export interface UsageEvent {
    id: string;
    generationId: string;
    sessionId: string | null;
    matchedPrompt: string | null;
    feedback: FeedbackType | null;
    createdAt: string;
}
export declare class UsageTracker {
    private db;
    private registry;
    constructor(storage: MemoryStorage);
    private initializeTables;
    /**
     * Record a usage event when an auto-generated skill is injected
     */
    recordUsage(generationId: string, sessionId?: string, matchedPrompt?: string): string;
    /**
     * Record explicit user feedback for a usage event
     */
    setFeedback(eventId: string, feedback: FeedbackType): boolean;
    /**
     * Record explicit feedback for a generation (latest event)
     */
    setFeedbackForGeneration(generationId: string, feedback: FeedbackType): boolean;
    /**
     * Apply implicit feedback based on session goals completion
     */
    applyImplicitFeedback(sessionId: string, goalsCompletionRatio: number): number;
    /**
     * Get usage events for a generation
     */
    getByGeneration(generationId: string): UsageEvent[];
    /**
     * Get feedback stats for a generation (weighted)
     */
    getFeedbackStats(generationId: string): {
        totalEvents: number;
        weightedNegativeRatio: number;
        explicitPositive: number;
        explicitNegative: number;
        implicitPositive: number;
        implicitNegative: number;
    };
    /**
     * Get total usage count for a generation
     */
    getUsageCount(generationId: string): number;
    private rowToEvent;
}
//# sourceMappingURL=UsageTracker.d.ts.map