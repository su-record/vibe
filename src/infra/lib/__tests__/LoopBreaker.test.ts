import { describe, it, expect, beforeEach } from 'vitest';
import { LoopBreaker, LOOP_LIMITS } from '../LoopBreaker.js';
import type { LoopEvent, LoopLimitOptions } from '../LoopBreaker.js';

let breaker: LoopBreaker;

beforeEach(() => {
  breaker = new LoopBreaker();
});

// ══════════════════════════════════════════════════
// File edit counting and threshold
// ══════════════════════════════════════════════════
describe('file edit counting', () => {
  it('should not break before reaching the limit', () => {
    const limit = LOOP_LIMITS.MAX_SAME_FILE_EDITS;
    for (let i = 0; i < limit - 1; i++) {
      const result = breaker.recordFileEdit('src/utils/helper.ts');
      expect(result.shouldBreak).toBe(false);
      expect(result.reason).toBeNull();
    }
  });

  it('should break when file edit count reaches the limit', () => {
    const limit = LOOP_LIMITS.MAX_SAME_FILE_EDITS;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordFileEdit('src/utils/helper.ts');
    }
    const result = breaker.recordFileEdit('src/utils/helper.ts');
    expect(result.shouldBreak).toBe(true);
    expect(result.reason).toContain('src/utils/helper.ts');
    expect(result.reason).toContain(String(limit));
  });

  it('should track different files independently', () => {
    const limit = LOOP_LIMITS.MAX_SAME_FILE_EDITS;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordFileEdit('src/a.ts');
    }
    // Different file should not be affected
    const result = breaker.recordFileEdit('src/b.ts');
    expect(result.shouldBreak).toBe(false);
  });

  it('should include file edit counts in counters', () => {
    breaker.recordFileEdit('src/foo.ts');
    breaker.recordFileEdit('src/foo.ts');
    const counters = breaker.getCounters();
    expect(counters.fileEditCounts['src/foo.ts']).toBe(2);
  });

  it('should dispatch file_edit event via recordEvent', () => {
    const limit = LOOP_LIMITS.MAX_SAME_FILE_EDITS;
    let result = breaker.recordEvent({ type: 'file_edit', target: 'src/x.ts', timestamp: Date.now() });
    expect(result.shouldBreak).toBe(false);

    for (let i = 1; i < limit; i++) {
      result = breaker.recordEvent({ type: 'file_edit', target: 'src/x.ts', timestamp: Date.now() });
    }
    expect(result.shouldBreak).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// Agent recursion depth tracking
// ══════════════════════════════════════════════════
describe('agent recursion depth tracking', () => {
  it('should not break before reaching the recursion limit', () => {
    const limit = LOOP_LIMITS.MAX_AGENT_RECURSION;
    for (let i = 0; i < limit - 1; i++) {
      const result = breaker.recordAgentCall('my-agent');
      expect(result.shouldBreak).toBe(false);
    }
  });

  it('should break when recursion depth reaches the limit', () => {
    const limit = LOOP_LIMITS.MAX_AGENT_RECURSION;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordAgentCall('my-agent');
    }
    const result = breaker.recordAgentCall('my-agent');
    expect(result.shouldBreak).toBe(true);
    expect(result.reason).toContain('my-agent');
    expect(result.reason).toContain(String(limit));
  });

  it('should track different agents independently', () => {
    const limit = LOOP_LIMITS.MAX_AGENT_RECURSION;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordAgentCall('agent-a');
    }
    const result = breaker.recordAgentCall('agent-b');
    expect(result.shouldBreak).toBe(false);
  });

  it('should include agent call depth in counters', () => {
    breaker.recordAgentCall('builder');
    breaker.recordAgentCall('builder');
    const counters = breaker.getCounters();
    expect(counters.agentCallDepth['builder']).toBe(2);
  });

  it('should dispatch agent_call event via recordEvent', () => {
    const limit = LOOP_LIMITS.MAX_AGENT_RECURSION;
    let result: ReturnType<typeof breaker.recordEvent> | undefined;
    for (let i = 0; i < limit; i++) {
      result = breaker.recordEvent({ type: 'agent_call', target: 'worker', timestamp: Date.now() });
    }
    expect(result?.shouldBreak).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// Consecutive error detection
// ══════════════════════════════════════════════════
describe('consecutive error detection', () => {
  it('should not break before reaching the error limit', () => {
    const limit = LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS;
    for (let i = 0; i < limit - 1; i++) {
      const result = breaker.recordError();
      expect(result.shouldBreak).toBe(false);
    }
  });

  it('should break when consecutive errors reach the limit', () => {
    const limit = LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordError();
    }
    const result = breaker.recordError();
    expect(result.shouldBreak).toBe(true);
    expect(result.reason).toContain(String(limit));
  });

  it('should reset consecutive error count after success', () => {
    breaker.recordError();
    breaker.recordError();
    breaker.recordSuccess();
    const counters = breaker.getCounters();
    expect(counters.consecutiveErrors).toBe(0);
  });

  it('should not break after success resets errors', () => {
    const limit = LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordError();
    }
    breaker.recordSuccess();
    const result = breaker.recordError();
    expect(result.shouldBreak).toBe(false);
  });

  it('should dispatch error event via recordEvent', () => {
    const limit = LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS;
    let result: ReturnType<typeof breaker.recordEvent> | undefined;
    for (let i = 0; i < limit; i++) {
      result = breaker.recordEvent({ type: 'error', target: '', timestamp: Date.now() });
    }
    expect(result?.shouldBreak).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// Cooldown period
// ══════════════════════════════════════════════════
describe('cooldown period', () => {
  it('should not be in cooldown initially', () => {
    expect(breaker.isInCooldown()).toBe(false);
  });

  it('should be in cooldown immediately after an error', () => {
    breaker.recordError();
    expect(breaker.isInCooldown()).toBe(true);
  });

  it('should not be in cooldown when last error timestamp is outside cooldown window', () => {
    const shortCooldown = new LoopBreaker({ COOLDOWN_MS: 1 });
    shortCooldown.recordError();
    // Wait for the 1ms cooldown to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(shortCooldown.isInCooldown()).toBe(false);
        resolve();
      }, 10);
    });
  });

  it('should remain in cooldown within cooldown window', () => {
    const longCooldown = new LoopBreaker({ COOLDOWN_MS: 60_000 });
    longCooldown.recordError();
    expect(longCooldown.isInCooldown()).toBe(true);
  });

  it('should reset cooldown after reset()', () => {
    breaker.recordError();
    breaker.reset();
    expect(breaker.isInCooldown()).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// Total iteration limit
// ══════════════════════════════════════════════════
describe('total iteration limit', () => {
  it('should not break before reaching the total iteration limit', () => {
    const limit = LOOP_LIMITS.MAX_TOTAL_ITERATIONS;
    for (let i = 0; i < limit - 1; i++) {
      const result = breaker.recordIteration();
      expect(result.shouldBreak).toBe(false);
    }
  });

  it('should break when total iterations reach the limit', () => {
    const limit = LOOP_LIMITS.MAX_TOTAL_ITERATIONS;
    for (let i = 0; i < limit - 1; i++) {
      breaker.recordIteration();
    }
    const result = breaker.recordIteration();
    expect(result.shouldBreak).toBe(true);
    expect(result.reason).toContain(String(limit));
  });

  it('should track total iterations in counters', () => {
    breaker.recordIteration();
    breaker.recordIteration();
    breaker.recordIteration();
    expect(breaker.getCounters().totalIterations).toBe(3);
  });

  it('should dispatch iteration event via recordEvent', () => {
    const limit = LOOP_LIMITS.MAX_TOTAL_ITERATIONS;
    let result: ReturnType<typeof breaker.recordEvent> | undefined;
    const event: LoopEvent = { type: 'iteration', target: '', timestamp: Date.now() };
    for (let i = 0; i < limit; i++) {
      result = breaker.recordEvent(event);
    }
    expect(result?.shouldBreak).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// Reset functionality
// ══════════════════════════════════════════════════
describe('reset functionality', () => {
  it('should reset all counters to initial state', () => {
    breaker.recordFileEdit('src/a.ts');
    breaker.recordAgentCall('agent-x');
    breaker.recordError();
    breaker.recordIteration();
    breaker.reset();

    const counters = breaker.getCounters();
    expect(counters.fileEditCounts).toEqual({});
    expect(counters.agentCallDepth).toEqual({});
    expect(counters.consecutiveErrors).toBe(0);
    expect(counters.totalIterations).toBe(0);
    expect(counters.lastErrorTimestamp).toBeNull();
  });

  it('should allow recording events again after reset', () => {
    const limit = LOOP_LIMITS.MAX_SAME_FILE_EDITS;
    for (let i = 0; i < limit; i++) {
      breaker.recordFileEdit('src/a.ts');
    }
    breaker.reset();
    const result = breaker.recordFileEdit('src/a.ts');
    expect(result.shouldBreak).toBe(false);
  });

  it('should reset a specific file counter with resetFile', () => {
    breaker.recordFileEdit('src/a.ts');
    breaker.recordFileEdit('src/b.ts');
    breaker.resetFile('src/a.ts');

    const counters = breaker.getCounters();
    expect(counters.fileEditCounts['src/a.ts']).toBeUndefined();
    expect(counters.fileEditCounts['src/b.ts']).toBe(1);
  });

  it('should allow file to be edited again after resetFile', () => {
    const limit = LOOP_LIMITS.MAX_SAME_FILE_EDITS;
    for (let i = 0; i < limit; i++) {
      breaker.recordFileEdit('src/a.ts');
    }
    breaker.resetFile('src/a.ts');
    const result = breaker.recordFileEdit('src/a.ts');
    expect(result.shouldBreak).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// Custom limits
// ══════════════════════════════════════════════════
describe('custom limits', () => {
  it('should use custom MAX_SAME_FILE_EDITS', () => {
    const custom = new LoopBreaker({ MAX_SAME_FILE_EDITS: 2 });
    custom.recordFileEdit('src/a.ts');
    const result = custom.recordFileEdit('src/a.ts');
    expect(result.shouldBreak).toBe(true);
  });

  it('should use custom MAX_AGENT_RECURSION', () => {
    const custom = new LoopBreaker({ MAX_AGENT_RECURSION: 1 });
    const result = custom.recordAgentCall('fast-limit-agent');
    expect(result.shouldBreak).toBe(true);
  });

  it('should use custom MAX_CONSECUTIVE_ERRORS', () => {
    const custom = new LoopBreaker({ MAX_CONSECUTIVE_ERRORS: 2 });
    custom.recordError();
    const result = custom.recordError();
    expect(result.shouldBreak).toBe(true);
  });

  it('should use custom MAX_TOTAL_ITERATIONS', () => {
    const custom = new LoopBreaker({ MAX_TOTAL_ITERATIONS: 3 });
    custom.recordIteration();
    custom.recordIteration();
    const result = custom.recordIteration();
    expect(result.shouldBreak).toBe(true);
  });

  it('should merge custom limits with defaults', () => {
    const custom = new LoopBreaker({ MAX_SAME_FILE_EDITS: 2 });
    // Other defaults still apply — agent recursion limit is still default
    const limit = LOOP_LIMITS.MAX_AGENT_RECURSION;
    for (let i = 0; i < limit - 1; i++) {
      const r = custom.recordAgentCall('agent');
      expect(r.shouldBreak).toBe(false);
    }
    const result = custom.recordAgentCall('agent');
    expect(result.shouldBreak).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// getCounters immutability
// ══════════════════════════════════════════════════
describe('getCounters immutability', () => {
  it('should return a snapshot that does not mutate internal state', () => {
    breaker.recordFileEdit('src/a.ts');
    const snapshot = breaker.getCounters();
    snapshot.fileEditCounts['src/a.ts'] = 999;

    const fresh = breaker.getCounters();
    expect(fresh.fileEditCounts['src/a.ts']).toBe(1);
  });

  it('should include all counter fields', () => {
    const counters = breaker.getCounters();
    expect(counters).toHaveProperty('fileEditCounts');
    expect(counters).toHaveProperty('agentCallDepth');
    expect(counters).toHaveProperty('consecutiveErrors');
    expect(counters).toHaveProperty('totalIterations');
    expect(counters).toHaveProperty('lastErrorTimestamp');
  });
});

// ══════════════════════════════════════════════════
// LoopBreakResult shape
// ══════════════════════════════════════════════════
describe('LoopBreakResult shape', () => {
  it('should include counters snapshot in result', () => {
    const result = breaker.recordFileEdit('src/a.ts');
    expect(result).toHaveProperty('shouldBreak');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('counters');
    expect(result.counters.fileEditCounts['src/a.ts']).toBe(1);
  });

  it('should set reason to null when not breaking', () => {
    const result = breaker.recordIteration();
    expect(result.shouldBreak).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('should provide a non-null reason when breaking', () => {
    const custom = new LoopBreaker({ MAX_AGENT_RECURSION: 1 });
    const result = custom.recordAgentCall('sentinel');
    expect(result.shouldBreak).toBe(true);
    expect(typeof result.reason).toBe('string');
    expect(result.reason!.length).toBeGreaterThan(0);
  });
});
