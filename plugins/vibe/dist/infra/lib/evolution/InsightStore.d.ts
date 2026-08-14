import { MemoryStorage } from '../memory/MemoryStorage.js';
export type InsightType = 'pattern' | 'anti_pattern' | 'preference' | 'skill_gap' | 'optimization';
export type InsightStatus = 'draft' | 'confirmed' | 'applied' | 'deprecated';
export type InsightSource = 'reflection' | 'observation' | 'agent_stats' | 'manual';
export interface Insight {
    id: string;
    type: InsightType;
    title: string;
    description: string;
    evidence: string[];
    confidence: number;
    occurrences: number;
    tags: string[];
    status: InsightStatus;
    generatedFrom: InsightSource;
    appliedAs: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface InsightInput {
    type: InsightType;
    title: string;
    description: string;
    evidence?: string[];
    confidence?: number;
    tags?: string[];
    generatedFrom: InsightSource;
}
export declare class InsightStore {
    private db;
    private fts5Available;
    constructor(storage: MemoryStorage);
    private initializeTables;
    save(input: InsightInput): string;
    /**
     * Check for duplicate and merge (increment occurrences) if found
     * Returns existing ID if merged, null if no duplicate
     */
    findAndMergeDuplicate(title: string, description: string): string | null;
    search(query: string, limit?: number): Insight[];
    getById(id: string): Insight | null;
    getActionable(): Insight[];
    getByStatus(status: InsightStatus, limit?: number): Insight[];
    getByType(type: InsightType, limit?: number): Insight[];
    updateStatus(id: string, status: InsightStatus): boolean;
    setAppliedAs(id: string, generationId: string): boolean;
    cleanupLowConfidence(maxAge?: number): number;
    getStats(): {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
    };
    private rowToInsight;
}
//# sourceMappingURL=InsightStore.d.ts.map