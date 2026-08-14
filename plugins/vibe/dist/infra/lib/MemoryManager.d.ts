import { MemoryRelation, MemoryGraph } from '../types/tool.js';
import { MemoryItem } from './memory/MemoryStorage.js';
import { SearchStrategy, SearchOptions } from './memory/MemorySearch.js';
import { Observation, ObservationInput, ObservationType } from './memory/ObservationStore.js';
import { Decision, DecisionInput, Constraint, ConstraintInput, Goal, GoalInput, Evidence, EvidenceInput, SessionRAGStats, DecisionStatus, ConstraintType, ConstraintSeverity, GoalStatus, EvidenceType, EvidenceStatus } from './memory/SessionRAGStore.js';
import { RetrievalOptions, SessionRAGResult } from './memory/SessionRAGRetriever.js';
import { ReflectionStore, Reflection, ReflectionInput } from './memory/ReflectionStore.js';
export { MemoryItem } from './memory/MemoryStorage.js';
export { Observation, ObservationInput, ObservationType } from './memory/ObservationStore.js';
export { Decision, DecisionInput, Constraint, ConstraintInput, Goal, GoalInput, Evidence, EvidenceInput, SessionRAGStats, DecisionStatus, ConstraintType, ConstraintSeverity, GoalStatus, EvidenceType, EvidenceStatus } from './memory/SessionRAGStore.js';
export { RetrievalOptions, SessionRAGResult } from './memory/SessionRAGRetriever.js';
export { Reflection, ReflectionInput, ReflectionType, ReflectionTrigger } from './memory/ReflectionStore.js';
export declare class MemoryManager {
    private storage;
    private graph;
    private memorySearch;
    private observations;
    private sessionRAG;
    private ragRetriever;
    private reflections;
    private static instances;
    private static instance;
    private static cleanupRegistered;
    private constructor();
    /**
     * Check if the given path is the core package itself
     */
    private isCorePackage;
    /**
     * Get MemoryManager instance for a specific project
     */
    static getInstance(projectPath?: string): MemoryManager;
    save(key: string, value: string, category?: string, priority?: number): void;
    recall(key: string): MemoryItem | null;
    delete(key: string): boolean;
    update(key: string, value: string): boolean;
    list(category?: string): MemoryItem[];
    getByPriority(priority: number): MemoryItem[];
    setPriority(key: string, priority: number): boolean;
    getStats(): {
        total: number;
        byCategory: Record<string, number>;
    };
    getTimeline(startDate?: string, endDate?: string, limit?: number): MemoryItem[];
    getDbPath(): string;
    linkMemories(sourceKey: string, targetKey: string, relationType: string, strength?: number, metadata?: Record<string, unknown>): boolean;
    getRelations(key: string, direction?: 'outgoing' | 'incoming' | 'both'): MemoryRelation[];
    getRelatedMemories(key: string, depth?: number, relationType?: string): MemoryItem[];
    getMemoryGraph(key?: string, depth?: number): MemoryGraph;
    findPath(sourceKey: string, targetKey: string): string[] | null;
    unlinkMemories(sourceKey: string, targetKey: string, relationType?: string): boolean;
    search(query: string): MemoryItem[];
    searchAdvanced(query: string, strategy: SearchStrategy, options?: SearchOptions): MemoryItem[];
    searchAdvancedAsync(query: string, strategy: SearchStrategy, options?: SearchOptions): Promise<MemoryItem[]>;
    addObservation(input: ObservationInput): number;
    searchObservations(query: string, limit?: number): Observation[];
    getRecentObservations(limit?: number, type?: ObservationType): Observation[];
    getObservationsBySession(sessionId: string, limit?: number): Observation[];
    getObservationStats(): {
        total: number;
        byType: Record<string, number>;
    };
    addDecision(input: DecisionInput): number;
    getDecision(id: number): Decision | null;
    updateDecision(id: number, updates: Partial<DecisionInput>): boolean;
    listDecisions(sessionId?: string, status?: DecisionStatus, limit?: number): Decision[];
    searchDecisions(query: string, limit?: number): Decision[];
    addConstraint(input: ConstraintInput): number;
    getConstraint(id: number): Constraint | null;
    updateConstraint(id: number, updates: Partial<ConstraintInput>): boolean;
    listConstraints(sessionId?: string, type?: ConstraintType, severity?: ConstraintSeverity, limit?: number): Constraint[];
    addGoal(input: GoalInput): number;
    getGoal(id: number): Goal | null;
    updateGoal(id: number, updates: Partial<GoalInput>): boolean;
    getActiveGoals(limit?: number): Goal[];
    listGoals(sessionId?: string, status?: GoalStatus, limit?: number): Goal[];
    addEvidence(input: EvidenceInput): number;
    getEvidence(id: number): Evidence | null;
    listEvidence(sessionId?: string, type?: EvidenceType, status?: EvidenceStatus, limit?: number): Evidence[];
    retrieveSessionContext(options: RetrievalOptions): SessionRAGResult;
    retrieveActiveContext(): {
        goals: Goal[];
        constraints: Constraint[];
        decisions: Decision[];
    };
    getSessionRAGStats(): SessionRAGStats;
    getReflectionStore(): ReflectionStore;
    addReflection(input: ReflectionInput): string;
    searchReflections(query: string, limit?: number): Reflection[];
    getRecentReflections(limit?: number): Reflection[];
    getHighValueReflections(minScore?: number, limit?: number): Reflection[];
    getReflectionsBySession(sessionId: string): Reflection[];
    close(): void;
    static resetInstance(projectPath?: string): void;
}
//# sourceMappingURL=MemoryManager.d.ts.map