import { MemoryStorage } from './MemoryStorage.js';
export interface SessionSummary {
    id: number;
    sessionId: string;
    request: string | null;
    investigated: string | null;
    learned: string | null;
    completed: string | null;
    nextSteps: string | null;
    filesRead: string[];
    filesEdited: string[];
    timestamp: string;
}
export interface SessionSummaryInput {
    sessionId: string;
    request?: string;
    investigated?: string;
    learned?: string;
    completed?: string;
    nextSteps?: string;
    filesRead?: string[];
    filesEdited?: string[];
}
export declare class SessionSummarizer {
    private db;
    private observations;
    constructor(storage: MemoryStorage);
    /**
     * Save or update a session summary
     */
    saveSummary(input: SessionSummaryInput): number;
    /**
     * Get recent session summaries
     */
    getRecentSummaries(limit?: number): SessionSummary[];
    /**
     * Get summary for a specific session
     */
    getSummary(sessionId: string): SessionSummary | null;
    /**
     * Auto-generate a session summary from observations
     */
    generateSummaryFromObservations(sessionId: string): SessionSummaryInput;
    /**
     * Generate rich context markdown for session start
     */
    generateSessionContext(tokenBudget?: number): string;
    private rowToSummary;
}
//# sourceMappingURL=SessionSummarizer.d.ts.map