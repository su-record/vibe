/**
 * LoopBreaker — Agent infinite loop and repetitive action prevention
 *
 * Implements loop-breaker concepts in TypeScript:
 * - maxSameFileEdits: stop when same file is edited N+ times
 * - maxAgentRecursion: limit agent recursive call depth
 * - maxConsecutiveErrors: stop after N consecutive errors
 * - cooldownMs: cooldown period after failures
 *
 * @deprecated Not wired into the vibe runtime (no hook/skill/CLI consumer).
 * In-memory counter state does not survive vibe's per-event process model.
 * Retained for API compatibility; may be removed in a future major.
 */
export declare const LOOP_LIMITS: {
    readonly MAX_SAME_FILE_EDITS: 10;
    readonly MAX_AGENT_RECURSION: 3;
    readonly MAX_CONSECUTIVE_ERRORS: 5;
    readonly COOLDOWN_MS: 60000;
    readonly MAX_TOTAL_ITERATIONS: 50;
};
export interface LoopLimitOptions {
    MAX_SAME_FILE_EDITS?: number;
    MAX_AGENT_RECURSION?: number;
    MAX_CONSECUTIVE_ERRORS?: number;
    COOLDOWN_MS?: number;
    MAX_TOTAL_ITERATIONS?: number;
}
export interface LoopEvent {
    type: 'file_edit' | 'agent_call' | 'error' | 'iteration';
    target: string;
    timestamp: number;
}
export interface LoopBreakResult {
    shouldBreak: boolean;
    reason: string | null;
    counters: LoopCounters;
}
export interface LoopCounters {
    fileEditCounts: Record<string, number>;
    agentCallDepth: Record<string, number>;
    consecutiveErrors: number;
    totalIterations: number;
    lastErrorTimestamp: number | null;
}
export declare class LoopBreaker {
    private counters;
    private readonly limits;
    constructor(limits?: LoopLimitOptions);
    recordEvent(event: LoopEvent): LoopBreakResult;
    recordFileEdit(filePath: string): LoopBreakResult;
    recordAgentCall(agentName: string): LoopBreakResult;
    recordError(): LoopBreakResult;
    recordSuccess(): void;
    recordIteration(): LoopBreakResult;
    isInCooldown(): boolean;
    getCounters(): Readonly<LoopCounters>;
    reset(): void;
    resetFile(filePath: string): void;
}
//# sourceMappingURL=LoopBreaker.d.ts.map