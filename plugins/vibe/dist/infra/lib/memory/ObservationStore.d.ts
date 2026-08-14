import { MemoryStorage } from './MemoryStorage.js';
export type ObservationType = 'decision' | 'bugfix' | 'feature' | 'refactor' | 'discovery';
export interface Observation {
    id: number;
    sessionId: string | null;
    type: ObservationType;
    title: string;
    narrative: string | null;
    facts: string[];
    concepts: string[];
    filesModified: string[];
    timestamp: string;
    projectPath: string | null;
}
export interface ObservationInput {
    sessionId?: string;
    type: ObservationType;
    title: string;
    narrative?: string;
    facts?: string[];
    concepts?: string[];
    filesModified?: string[];
    projectPath?: string;
}
export declare class ObservationStore {
    private db;
    constructor(storage: MemoryStorage);
    /**
     * Add a new observation
     */
    add(input: ObservationInput): number;
    /**
     * Get observations by session ID
     */
    getBySession(sessionId: string, limit?: number): Observation[];
    /**
     * Get recent observations
     */
    getRecent(limit?: number, type?: ObservationType): Observation[];
    /**
     * Get observations by type
     */
    getByType(type: ObservationType, limit?: number): Observation[];
    /**
     * Search observations using FTS5 (with LIKE fallback)
     */
    search(query: string, limit?: number): Observation[];
    /**
     * Get observation statistics
     */
    getStats(): {
        total: number;
        byType: Record<string, number>;
    };
    /**
     * Delete observations by session ID
     */
    deleteBySession(sessionId: string): number;
    private rowToObservation;
}
//# sourceMappingURL=ObservationStore.d.ts.map