import { MemoryStorage } from '../memory/MemoryStorage.js';
export type GenerationType = 'skill' | 'agent' | 'rule';
export type GenerationStatus = 'draft' | 'testing' | 'active' | 'disabled' | 'deleted';
export interface Generation {
    id: string;
    insightId: string;
    type: GenerationType;
    name: string;
    content: string;
    filePath: string | null;
    status: GenerationStatus;
    qualityScore: number;
    triggerPatterns: string[];
    usageCount: number;
    lastUsedAt: string | null;
    ttlDays: number;
    version: number;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface GenerationInput {
    insightId: string;
    type: GenerationType;
    name: string;
    content: string;
    filePath?: string;
    status?: GenerationStatus;
    qualityScore?: number;
    triggerPatterns?: string[];
    ttlDays?: number;
    parentId?: string;
}
export declare class GenerationRegistry {
    private db;
    constructor(storage: MemoryStorage);
    private initializeTables;
    save(input: GenerationInput): string;
    getById(id: string): Generation | null;
    getByName(name: string): Generation | null;
    getActive(type?: GenerationType): Generation[];
    getByStatus(status: GenerationStatus, limit?: number): Generation[];
    updateStatus(id: string, status: GenerationStatus): boolean;
    incrementUsage(id: string): void;
    getStats(): {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
    };
    getRecentFailures(limit?: number): number;
    private rowToGeneration;
}
//# sourceMappingURL=GenerationRegistry.d.ts.map