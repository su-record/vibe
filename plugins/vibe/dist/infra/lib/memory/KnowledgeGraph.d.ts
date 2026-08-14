import { MemoryRelation, MemoryGraph } from '../../types/tool.js';
import { MemoryItem, MemoryStorage } from './MemoryStorage.js';
export declare class KnowledgeGraph {
    private db;
    private storage;
    constructor(storage: MemoryStorage);
    /**
     * Link two memories with a relationship
     */
    linkMemories(sourceKey: string, targetKey: string, relationType: string, strength?: number, metadata?: Record<string, unknown>): boolean;
    /**
     * Get all relations for a memory
     */
    getRelations(key: string, direction?: 'outgoing' | 'incoming' | 'both'): MemoryRelation[];
    /**
     * Get related memories using graph traversal
     */
    getRelatedMemories(key: string, depth?: number, relationType?: string): MemoryItem[];
    /**
     * Get memory graph structure
     */
    getMemoryGraph(key?: string, depth?: number): MemoryGraph;
    private buildGraphFromKey;
    private detectClusters;
    /**
     * Find shortest path between two memories
     */
    findPath(sourceKey: string, targetKey: string): string[] | null;
    /**
     * Remove a relationship between memories
     */
    unlinkMemories(sourceKey: string, targetKey: string, relationType?: string): boolean;
}
//# sourceMappingURL=KnowledgeGraph.d.ts.map