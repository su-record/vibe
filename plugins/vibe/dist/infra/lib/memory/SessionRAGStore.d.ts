import { MemoryStorage } from './MemoryStorage.js';
export type DecisionStatus = 'active' | 'superseded' | 'cancelled';
export type ConstraintType = 'technical' | 'business' | 'resource' | 'quality';
export type ConstraintSeverity = 'low' | 'medium' | 'high' | 'critical';
export type GoalStatus = 'active' | 'completed' | 'blocked' | 'cancelled';
export type EvidenceType = 'test' | 'build' | 'lint' | 'coverage' | 'hud' | 'review';
export type EvidenceStatus = 'pass' | 'fail' | 'warning' | 'info';
export interface Decision {
    id: number;
    sessionId: string | null;
    title: string;
    description: string | null;
    rationale: string | null;
    alternatives: string[];
    impact: string | null;
    status: DecisionStatus;
    priority: number;
    relatedFiles: string[];
    tags: string[];
    timestamp: string;
}
export interface DecisionInput {
    sessionId?: string;
    taskId?: string;
    title: string;
    description?: string;
    rationale?: string;
    alternatives?: string[];
    impact?: string;
    status?: DecisionStatus;
    priority?: number;
    relatedFiles?: string[];
    tags?: string[];
}
export interface Constraint {
    id: number;
    sessionId: string | null;
    title: string;
    description: string | null;
    type: ConstraintType;
    severity: ConstraintSeverity;
    scope: string | null;
    timestamp: string;
}
export interface ConstraintInput {
    sessionId?: string;
    taskId?: string;
    title: string;
    description?: string;
    type: ConstraintType;
    severity?: ConstraintSeverity;
    scope?: string;
}
export interface Goal {
    id: number;
    sessionId: string | null;
    parentId: number | null;
    title: string;
    description: string | null;
    status: GoalStatus;
    priority: number;
    progressPercent: number;
    successCriteria: string[];
    timestamp: string;
    completedAt: string | null;
}
export interface GoalInput {
    sessionId?: string;
    taskId?: string;
    parentId?: number;
    title: string;
    description?: string;
    status?: GoalStatus;
    priority?: number;
    progressPercent?: number;
    successCriteria?: string[];
}
export interface Evidence {
    id: number;
    sessionId: string | null;
    type: EvidenceType;
    title: string;
    status: EvidenceStatus;
    details: Record<string, unknown> | null;
    metrics: Record<string, unknown> | null;
    relatedGoals: number[];
    timestamp: string;
}
export interface EvidenceInput {
    sessionId?: string;
    taskId?: string;
    type: EvidenceType;
    title: string;
    status: EvidenceStatus;
    details?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
    relatedGoals?: number[];
}
export interface SessionRAGStats {
    decisions: {
        total: number;
        byStatus: Record<string, number>;
    };
    constraints: {
        total: number;
        byType: Record<string, number>;
    };
    goals: {
        total: number;
        byStatus: Record<string, number>;
    };
    evidence: {
        total: number;
        byType: Record<string, number>;
    };
}
export declare class SessionRAGStore {
    private db;
    private fts5Available;
    constructor(storage: MemoryStorage);
    private initializeTables;
    private initializeFTS5;
    addDecision(input: DecisionInput): number;
    getDecision(id: number): Decision | null;
    updateDecision(id: number, updates: Partial<DecisionInput>): boolean;
    listDecisions(sessionId?: string, status?: DecisionStatus, limit?: number): Decision[];
    searchDecisions(query: string, limit?: number): Decision[];
    deleteDecision(id: number): boolean;
    private rowToDecision;
    addConstraint(input: ConstraintInput): number;
    getConstraint(id: number): Constraint | null;
    updateConstraint(id: number, updates: Partial<ConstraintInput>): boolean;
    listConstraints(sessionId?: string, type?: ConstraintType, severity?: ConstraintSeverity, limit?: number): Constraint[];
    searchConstraints(query: string, limit?: number): Constraint[];
    deleteConstraint(id: number): boolean;
    private rowToConstraint;
    addGoal(input: GoalInput): number;
    getGoal(id: number): Goal | null;
    updateGoal(id: number, updates: Partial<GoalInput> & {
        completedAt?: string;
    }): boolean;
    listGoals(sessionId?: string, status?: GoalStatus, limit?: number): Goal[];
    getActiveGoals(limit?: number): Goal[];
    getGoalHierarchy(rootId?: number): Goal[];
    searchGoals(query: string, limit?: number): Goal[];
    deleteGoal(id: number): boolean;
    private rowToGoal;
    addEvidence(input: EvidenceInput): number;
    getEvidence(id: number): Evidence | null;
    listEvidence(sessionId?: string, type?: EvidenceType, status?: EvidenceStatus, limit?: number): Evidence[];
    getRecentEvidence(limit?: number): Evidence[];
    searchEvidence(query: string, limit?: number): Evidence[];
    deleteEvidence(id: number): boolean;
    private rowToEvidence;
    deleteByTaskId(taskId: string): void;
    getStats(): SessionRAGStats;
    /** Save a conversation entry (user or assistant) */
    saveConversationEntry(chatId: string, role: 'user' | 'assistant', content: string, timestamp?: string): void;
    /** Get recent conversation history (default 24h, max 8000 chars) */
    getRecentConversationHistory(chatId: string, hoursBack?: number, maxChars?: number): Array<{
        role: string;
        content: string;
        timestamp: string;
    }>;
    /** Delete conversation entries older than specified hours */
    cleanupOldConversationHistory(olderThanHours?: number): void;
}
//# sourceMappingURL=SessionRAGStore.d.ts.map