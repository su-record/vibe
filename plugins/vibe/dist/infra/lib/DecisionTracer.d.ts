/**
 * DecisionTracer — AI decision audit trail
 *
 * All data is stored locally only (JSONL).
 * File: ~/.vibe/analytics/decisions.jsonl
 *
 * @deprecated Not wired into the vibe runtime (no hook/skill/CLI consumer).
 * In-memory instance state does not survive vibe's per-event process model.
 * Retained for API compatibility; may be removed in a future major.
 */
export interface DecisionRecord {
    /** Schema version */
    v: 1;
    /** ISO 8601 timestamp */
    ts: string;
    /** Decision category */
    category: DecisionCategory;
    /** What was decided */
    decision: string;
    /** Why this was chosen (rationale) */
    rationale: string;
    /** What alternatives were considered */
    alternatives: string[];
    /** Context that informed the decision */
    context: DecisionContext;
    /** Outcome (filled later via updateOutcome) */
    outcome?: DecisionOutcome;
    /** Unique decision ID */
    id: string;
}
export type DecisionCategory = 'architecture' | 'implementation' | 'fix_strategy' | 'verification' | 'retry' | 'scope_change' | 'tool_selection';
export interface DecisionContext {
    /** Feature/SPEC being worked on */
    feature?: string;
    /** Current phase */
    phase?: string;
    /** Related file paths */
    files: string[];
    /** Automation level at time of decision */
    automationLevel?: number;
}
export interface DecisionOutcome {
    /** Whether the decision led to success */
    success: boolean;
    /** Impact description */
    impact: string;
    /** Timestamp of outcome recording */
    recordedAt: string;
}
export interface DecisionInput {
    category: DecisionCategory;
    decision: string;
    rationale: string;
    alternatives?: string[];
    context?: Partial<DecisionContext>;
}
export interface FeatureSummary {
    feature: string;
    totalDecisions: number;
    byCategory: Record<string, number>;
    successRate: number | null;
    decisions: DecisionRecord[];
}
export declare class DecisionTracer {
    private readonly logPath;
    private readonly enabled;
    constructor(analyticsDir: string, enabled?: boolean);
    /** Record a new decision */
    record(input: DecisionInput): DecisionRecord;
    /** Update outcome for a previous decision */
    updateOutcome(decisionId: string, outcome: Omit<DecisionOutcome, 'recordedAt'>): boolean;
    /** Read all decisions */
    readAll(): DecisionRecord[];
    /** Query decisions by category */
    queryByCategory(category: DecisionCategory): DecisionRecord[];
    /** Query decisions by feature */
    queryByFeature(feature: string): DecisionRecord[];
    /** Get recent decisions (last N) */
    getRecent(count: number): DecisionRecord[];
    /** Summarize decisions for a feature */
    summarizeFeature(feature: string): FeatureSummary;
    /** Get log path */
    getLogPath(): string;
}
//# sourceMappingURL=DecisionTracer.d.ts.map