/**
 * LoopBreaker — Agent infinite loop and repetitive action prevention
 *
 * Implements loop-breaker concepts in TypeScript:
 * - maxSameFileEdits: stop when same file is edited N+ times
 * - maxAgentRecursion: limit agent recursive call depth
 * - maxConsecutiveErrors: stop after N consecutive errors
 * - cooldownMs: cooldown period after failures
 */

// Constants
export const LOOP_LIMITS = {
  MAX_SAME_FILE_EDITS: 10,
  MAX_AGENT_RECURSION: 3,
  MAX_CONSECUTIVE_ERRORS: 5,
  COOLDOWN_MS: 60_000,
  MAX_TOTAL_ITERATIONS: 50,
} as const;

export interface LoopLimitOptions {
  MAX_SAME_FILE_EDITS?: number;
  MAX_AGENT_RECURSION?: number;
  MAX_CONSECUTIVE_ERRORS?: number;
  COOLDOWN_MS?: number;
  MAX_TOTAL_ITERATIONS?: number;
}

// Types
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

type LoopLimits = {
  MAX_SAME_FILE_EDITS: number;
  MAX_AGENT_RECURSION: number;
  MAX_CONSECUTIVE_ERRORS: number;
  COOLDOWN_MS: number;
  MAX_TOTAL_ITERATIONS: number;
};

function makeDefaultCounters(): LoopCounters {
  return {
    fileEditCounts: {},
    agentCallDepth: {},
    consecutiveErrors: 0,
    totalIterations: 0,
    lastErrorTimestamp: null,
  };
}

function deepCopyCounters(counters: LoopCounters): LoopCounters {
  return {
    fileEditCounts: { ...counters.fileEditCounts },
    agentCallDepth: { ...counters.agentCallDepth },
    consecutiveErrors: counters.consecutiveErrors,
    totalIterations: counters.totalIterations,
    lastErrorTimestamp: counters.lastErrorTimestamp,
  };
}

function makeResult(shouldBreak: boolean, reason: string | null, counters: LoopCounters): LoopBreakResult {
  return { shouldBreak, reason, counters: deepCopyCounters(counters) };
}

// Class
export class LoopBreaker {
  private counters: LoopCounters;
  private readonly limits: LoopLimits;

  constructor(limits?: LoopLimitOptions) {
    this.limits = { ...LOOP_LIMITS, ...limits };
    this.counters = makeDefaultCounters();
  }

  recordEvent(event: LoopEvent): LoopBreakResult {
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

  recordFileEdit(filePath: string): LoopBreakResult {
    const current = this.counters.fileEditCounts[filePath] ?? 0;
    this.counters.fileEditCounts[filePath] = current + 1;

    if (this.counters.fileEditCounts[filePath] >= this.limits.MAX_SAME_FILE_EDITS) {
      return makeResult(
        true,
        `File "${filePath}" edited ${this.counters.fileEditCounts[filePath]} times (limit: ${this.limits.MAX_SAME_FILE_EDITS})`,
        this.counters,
      );
    }

    return makeResult(false, null, this.counters);
  }

  recordAgentCall(agentName: string): LoopBreakResult {
    const current = this.counters.agentCallDepth[agentName] ?? 0;
    this.counters.agentCallDepth[agentName] = current + 1;

    if (this.counters.agentCallDepth[agentName] >= this.limits.MAX_AGENT_RECURSION) {
      return makeResult(
        true,
        `Agent "${agentName}" recursion depth ${this.counters.agentCallDepth[agentName]} reached limit (${this.limits.MAX_AGENT_RECURSION})`,
        this.counters,
      );
    }

    return makeResult(false, null, this.counters);
  }

  recordError(): LoopBreakResult {
    this.counters.consecutiveErrors += 1;
    this.counters.lastErrorTimestamp = Date.now();

    if (this.counters.consecutiveErrors >= this.limits.MAX_CONSECUTIVE_ERRORS) {
      return makeResult(
        true,
        `${this.counters.consecutiveErrors} consecutive errors reached limit (${this.limits.MAX_CONSECUTIVE_ERRORS})`,
        this.counters,
      );
    }

    return makeResult(false, null, this.counters);
  }

  recordSuccess(): void {
    this.counters.consecutiveErrors = 0;
  }

  recordIteration(): LoopBreakResult {
    this.counters.totalIterations += 1;

    if (this.counters.totalIterations >= this.limits.MAX_TOTAL_ITERATIONS) {
      return makeResult(
        true,
        `Total iterations ${this.counters.totalIterations} reached limit (${this.limits.MAX_TOTAL_ITERATIONS})`,
        this.counters,
      );
    }

    return makeResult(false, null, this.counters);
  }

  isInCooldown(): boolean {
    if (this.counters.lastErrorTimestamp === null) {
      return false;
    }
    return Date.now() - this.counters.lastErrorTimestamp < this.limits.COOLDOWN_MS;
  }

  getCounters(): Readonly<LoopCounters> {
    return deepCopyCounters(this.counters);
  }

  reset(): void {
    this.counters = makeDefaultCounters();
  }

  resetFile(filePath: string): void {
    delete this.counters.fileEditCounts[filePath];
  }
}
