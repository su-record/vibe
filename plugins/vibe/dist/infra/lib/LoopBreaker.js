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
// Constants
export const LOOP_LIMITS = {
    MAX_SAME_FILE_EDITS: 10,
    MAX_AGENT_RECURSION: 3,
    MAX_CONSECUTIVE_ERRORS: 5,
    COOLDOWN_MS: 60_000,
    MAX_TOTAL_ITERATIONS: 50,
};
function makeDefaultCounters() {
    return {
        fileEditCounts: {},
        agentCallDepth: {},
        consecutiveErrors: 0,
        totalIterations: 0,
        lastErrorTimestamp: null,
    };
}
function deepCopyCounters(counters) {
    return {
        fileEditCounts: { ...counters.fileEditCounts },
        agentCallDepth: { ...counters.agentCallDepth },
        consecutiveErrors: counters.consecutiveErrors,
        totalIterations: counters.totalIterations,
        lastErrorTimestamp: counters.lastErrorTimestamp,
    };
}
function makeResult(shouldBreak, reason, counters) {
    return { shouldBreak, reason, counters: deepCopyCounters(counters) };
}
// Class
export class LoopBreaker {
    counters;
    limits;
    constructor(limits) {
        this.limits = { ...LOOP_LIMITS, ...limits };
        this.counters = makeDefaultCounters();
    }
    recordEvent(event) {
        switch (event.type) {
            case 'file_edit':
                return this.recordFileEdit(event.target);
            case 'agent_call':
                return this.recordAgentCall(event.target);
            case 'error':
                return this.recordError();
            case 'iteration':
                return this.recordIteration();
        }
    }
    recordFileEdit(filePath) {
        const current = this.counters.fileEditCounts[filePath] ?? 0;
        this.counters.fileEditCounts[filePath] = current + 1;
        if (this.counters.fileEditCounts[filePath] >= this.limits.MAX_SAME_FILE_EDITS) {
            return makeResult(true, `File "${filePath}" edited ${this.counters.fileEditCounts[filePath]} times (limit: ${this.limits.MAX_SAME_FILE_EDITS})`, this.counters);
        }
        return makeResult(false, null, this.counters);
    }
    recordAgentCall(agentName) {
        const current = this.counters.agentCallDepth[agentName] ?? 0;
        this.counters.agentCallDepth[agentName] = current + 1;
        if (this.counters.agentCallDepth[agentName] >= this.limits.MAX_AGENT_RECURSION) {
            return makeResult(true, `Agent "${agentName}" recursion depth ${this.counters.agentCallDepth[agentName]} reached limit (${this.limits.MAX_AGENT_RECURSION})`, this.counters);
        }
        return makeResult(false, null, this.counters);
    }
    recordError() {
        this.counters.consecutiveErrors += 1;
        this.counters.lastErrorTimestamp = Date.now();
        if (this.counters.consecutiveErrors >= this.limits.MAX_CONSECUTIVE_ERRORS) {
            return makeResult(true, `${this.counters.consecutiveErrors} consecutive errors reached limit (${this.limits.MAX_CONSECUTIVE_ERRORS})`, this.counters);
        }
        return makeResult(false, null, this.counters);
    }
    recordSuccess() {
        this.counters.consecutiveErrors = 0;
    }
    recordIteration() {
        this.counters.totalIterations += 1;
        if (this.counters.totalIterations >= this.limits.MAX_TOTAL_ITERATIONS) {
            return makeResult(true, `Total iterations ${this.counters.totalIterations} reached limit (${this.limits.MAX_TOTAL_ITERATIONS})`, this.counters);
        }
        return makeResult(false, null, this.counters);
    }
    isInCooldown() {
        if (this.counters.lastErrorTimestamp === null) {
            return false;
        }
        return Date.now() - this.counters.lastErrorTimestamp < this.limits.COOLDOWN_MS;
    }
    getCounters() {
        return deepCopyCounters(this.counters);
    }
    reset() {
        this.counters = makeDefaultCounters();
    }
    resetFile(filePath) {
        delete this.counters.fileEditCounts[filePath];
    }
}
//# sourceMappingURL=LoopBreaker.js.map