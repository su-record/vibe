import { MemoryStorage } from './MemoryStorage.js';
export type ReflectionType = 'minor' | 'major';
export type ReflectionTrigger = 'context_pressure' | 'session_end' | 'manual';
export interface Reflection {
    id: string;
    sessionId: string | null;
    type: ReflectionType;
    trigger: ReflectionTrigger;
    insights: string[];
    decisions: string[];
    patterns: string[];
    filesContext: string[];
    score: number;
    createdAt: string;
}
export interface ReflectionInput {
    sessionId?: string;
    type: ReflectionType;
    trigger: ReflectionTrigger;
    insights?: string[];
    decisions?: string[];
    patterns?: string[];
    filesContext?: string[];
    score?: number;
}
export declare class ReflectionStore {
    private db;
    private fts5Available;
    constructor(storage: MemoryStorage);
    /**
     * Save a reflection to the database
     */
    save(input: ReflectionInput): string;
    /**
     * Search reflections using FTS5 (with LIKE fallback)
     */
    search(query: string, limit?: number): Reflection[];
    /**
     * Get reflections by session ID
     */
    getBySession(sessionId: string): Reflection[];
    /**
     * Get most recent reflections
     */
    getRecent(limit?: number): Reflection[];
    /**
     * Get high-value reflections (score >= minScore)
     */
    getHighValue(minScore?: number, limit?: number): Reflection[];
    /**
     * Get a reflection by ID
     */
    getById(id: string): Reflection | null;
    /**
     * Get reflection count
     */
    getCount(): number;
    private rowToReflection;
}
//# sourceMappingURL=ReflectionStore.d.ts.map