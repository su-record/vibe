import { describe, it, expect } from 'vitest';
import {
  createLoop,
  calculateAchievementRate,
  recordVerification,
  getUnmetRequirements,
  formatVerificationResult,
  formatLoopSummary,
  isImproving,
  DEFAULT_VERIFICATION_CONFIG,
} from '../VerificationLoop.js';
import type { RequirementResult, LoopState } from '../VerificationLoop.js';

// ══════════════════════════════════════════════════
// Fixtures
// ══════════════════════════════════════════════════

function makeReq(
  id: string,
  status: RequirementResult['status'],
  score: number,
  description = `Req ${id}`,
  evidence = 'test evidence'
): RequirementResult {
  return { id, description, status, score, evidence };
}

// ══════════════════════════════════════════════════
// calculateAchievementRate
// ══════════════════════════════════════════════════

describe('calculateAchievementRate', () => {
  it('should return 100 when all requirements pass', () => {
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'pass', 100),
      makeReq('REQ-003', 'pass', 100),
    ];
    expect(calculateAchievementRate(reqs)).toBe(100);
  });

  it('should return 0 when all requirements fail', () => {
    const reqs = [
      makeReq('REQ-001', 'fail', 0),
      makeReq('REQ-002', 'fail', 0),
    ];
    expect(calculateAchievementRate(reqs)).toBe(0);
  });

  it('should return weighted average for mixed results', () => {
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'fail', 0),
      makeReq('REQ-003', 'partial', 50),
    ];
    // (100 + 0 + 50) / 3 = 50
    expect(calculateAchievementRate(reqs)).toBe(50);
  });

  it('should exclude skipped requirements from calculation', () => {
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'skip', 0),
      makeReq('REQ-003', 'skip', 0),
    ];
    // Only REQ-001 counts: 100 / 1 = 100
    expect(calculateAchievementRate(reqs)).toBe(100);
  });

  it('should return 100 when all requirements are skipped', () => {
    const reqs = [
      makeReq('REQ-001', 'skip', 0),
      makeReq('REQ-002', 'skip', 0),
    ];
    expect(calculateAchievementRate(reqs)).toBe(100);
  });

  it('should return 100 for empty requirements array', () => {
    expect(calculateAchievementRate([])).toBe(100);
  });

  it('should round to nearest integer', () => {
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'pass', 100),
      makeReq('REQ-003', 'fail', 0),
    ];
    // (100 + 100 + 0) / 3 = 66.666...
    expect(calculateAchievementRate(reqs)).toBe(67);
  });

  it('should handle partial scores mixed with skips', () => {
    const reqs = [
      makeReq('REQ-001', 'partial', 60),
      makeReq('REQ-002', 'partial', 80),
      makeReq('REQ-003', 'skip', 0),
    ];
    // (60 + 80) / 2 = 70
    expect(calculateAchievementRate(reqs)).toBe(70);
  });
});

// ══════════════════════════════════════════════════
// createLoop
// ══════════════════════════════════════════════════

describe('createLoop', () => {
  it('should create loop with default config', () => {
    const state = createLoop('my-feature');
    expect(state.feature).toBe('my-feature');
    expect(state.config).toEqual(DEFAULT_VERIFICATION_CONFIG);
    expect(state.history).toHaveLength(0);
    expect(state.status).toBe('pending');
    expect(state.startedAt).toBeDefined();
    expect(state.completedAt).toBeUndefined();
  });

  it('should merge partial config overrides', () => {
    const state = createLoop('feature', { threshold: 80, autoRetry: true });
    expect(state.config.threshold).toBe(80);
    expect(state.config.autoRetry).toBe(true);
    expect(state.config.maxIterations).toBe(DEFAULT_VERIFICATION_CONFIG.maxIterations);
  });

  it('should start with empty history', () => {
    const state = createLoop('feature');
    expect(state.history).toEqual([]);
  });
});

// ══════════════════════════════════════════════════
// recordVerification — pass on first try
// ══════════════════════════════════════════════════

describe('recordVerification — pass on first try', () => {
  it('should return passed action when rate meets threshold', () => {
    const state = createLoop('feature', { threshold: 90 });
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'pass', 100),
    ];
    const { state: newState, action } = recordVerification(state, reqs);

    expect(action.type).toBe('passed');
    expect(action.rate).toBe(100);
    expect(newState.status).toBe('passed');
    expect(newState.completedAt).toBeDefined();
    expect(newState.history).toHaveLength(1);
  });

  it('should record the result in history', () => {
    const state = createLoop('feature');
    const reqs = [makeReq('REQ-001', 'pass', 100)];
    const { state: newState } = recordVerification(state, reqs);

    expect(newState.history[0].iteration).toBe(1);
    expect(newState.history[0].achievementRate).toBe(100);
    expect(newState.history[0].requirements).toEqual(reqs);
    expect(newState.history[0].timestamp).toBeDefined();
  });

  it('should pass exactly at threshold', () => {
    const state = createLoop('feature', { threshold: 90 });
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'pass', 100),
      makeReq('REQ-003', 'partial', 70),
    ];
    // (100 + 100 + 70) / 3 = 90
    const { action } = recordVerification(state, reqs);
    expect(action.type).toBe('passed');
  });
});

// ══════════════════════════════════════════════════
// recordVerification — retry flow
// ══════════════════════════════════════════════════

describe('recordVerification — retry flow', () => {
  it('should return retry action when rate is below threshold and iterations remain', () => {
    const state = createLoop('feature', { threshold: 90, maxIterations: 3 });
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'fail', 0),
    ];
    const { state: newState, action } = recordVerification(state, reqs);

    expect(action.type).toBe('retry');
    expect(newState.status).toBe('running');
    expect(newState.completedAt).toBeUndefined();
  });

  it('should include failed requirements in retry action', () => {
    const state = createLoop('feature', { threshold: 90, maxIterations: 3 });
    const failReq = makeReq('REQ-002', 'fail', 0);
    const partialReq = makeReq('REQ-003', 'partial', 50);
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      failReq,
      partialReq,
    ];
    const { action } = recordVerification(state, reqs);

    expect(action.type).toBe('retry');
    if (action.type === 'retry') {
      expect(action.failedRequirements).toHaveLength(2);
      expect(action.failedRequirements.map(r => r.id)).toContain('REQ-002');
      expect(action.failedRequirements.map(r => r.id)).toContain('REQ-003');
    }
  });

  it('should pass after retrying with improved requirements', () => {
    let state = createLoop('feature', { threshold: 80, maxIterations: 3 });

    // First iteration: 50% — retry
    const firstReqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'fail', 0),
    ];
    const result1 = recordVerification(state, firstReqs);
    expect(result1.action.type).toBe('retry');
    state = result1.state;

    // Second iteration: 100% — passed
    const secondReqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'pass', 100),
    ];
    const result2 = recordVerification(state, secondReqs);
    expect(result2.action.type).toBe('passed');
    expect(result2.state.status).toBe('passed');
    expect(result2.state.history).toHaveLength(2);
  });

  it('should track correct iteration numbers', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 5 });

    for (let i = 1; i <= 3; i++) {
      const reqs = [makeReq('REQ-001', 'fail', 0)];
      const result = recordVerification(state, reqs);
      expect(result.state.history[i - 1].iteration).toBe(i);
      state = result.state;
    }
  });
});

// ══════════════════════════════════════════════════
// recordVerification — max iterations
// ══════════════════════════════════════════════════

describe('recordVerification — max iterations', () => {
  it('should return max_iterations action when limit is reached', () => {
    let state = createLoop('feature', { threshold: 90, maxIterations: 2 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];

    const result1 = recordVerification(state, reqs);
    expect(result1.action.type).toBe('retry');
    state = result1.state;

    const result2 = recordVerification(state, reqs);
    expect(result2.action.type).toBe('max_iterations');
    expect(result2.state.status).toBe('max_iterations');
    expect(result2.state.completedAt).toBeDefined();
  });

  it('should include history in max_iterations action', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 1 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { action } = recordVerification(state, reqs);

    expect(action.type).toBe('max_iterations');
    if (action.type === 'max_iterations') {
      expect(action.history).toHaveLength(1);
    }
  });

  it('should not return retry action after maxIterations is exhausted', () => {
    let state = createLoop('feature', { threshold: 90, maxIterations: 3 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];

    for (let i = 0; i < 2; i++) {
      const result = recordVerification(state, reqs);
      state = result.state;
    }

    const finalResult = recordVerification(state, reqs);
    expect(finalResult.action.type).toBe('max_iterations');
  });
});

// ══════════════════════════════════════════════════
// getUnmetRequirements
// ══════════════════════════════════════════════════

describe('getUnmetRequirements', () => {
  it('should return fail and partial requirements', () => {
    const state = createLoop('feature');
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'fail', 0),
      makeReq('REQ-003', 'partial', 50),
      makeReq('REQ-004', 'skip', 0),
    ];
    const { state: newState } = recordVerification(state, reqs);
    const unmet = getUnmetRequirements(newState.history[0]);

    expect(unmet).toHaveLength(2);
    expect(unmet.map(r => r.id)).toContain('REQ-002');
    expect(unmet.map(r => r.id)).toContain('REQ-003');
  });

  it('should return empty array when all requirements pass', () => {
    const state = createLoop('feature');
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'pass', 100),
    ];
    const { state: newState } = recordVerification(state, reqs);
    const unmet = getUnmetRequirements(newState.history[0]);

    expect(unmet).toHaveLength(0);
  });

  it('should not include skipped requirements', () => {
    const state = createLoop('feature');
    const reqs = [makeReq('REQ-001', 'skip', 0)];
    const { state: newState } = recordVerification(state, reqs);
    const unmet = getUnmetRequirements(newState.history[0]);

    expect(unmet).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════
// isImproving
// ══════════════════════════════════════════════════

describe('isImproving', () => {
  it('should return false with fewer than 2 iterations', () => {
    const state = createLoop('feature');
    expect(isImproving(state)).toBe(false);

    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { state: afterOne } = recordVerification(state, reqs);
    expect(isImproving(afterOne)).toBe(false);
  });

  it('should return true when rate increases by at least 1%', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 5 });

    const firstReqs = [makeReq('REQ-001', 'fail', 0), makeReq('REQ-002', 'pass', 100)];
    state = recordVerification(state, firstReqs).state;

    const secondReqs = [makeReq('REQ-001', 'pass', 100), makeReq('REQ-002', 'pass', 100)];
    state = recordVerification(state, secondReqs).state;

    expect(isImproving(state)).toBe(true);
  });

  it('should return false when rate stays the same', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 5 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];

    state = recordVerification(state, reqs).state;
    state = recordVerification(state, reqs).state;

    expect(isImproving(state)).toBe(false);
  });

  it('should return false when rate decreases', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 5 });

    const firstReqs = [makeReq('REQ-001', 'pass', 100), makeReq('REQ-002', 'pass', 100)];
    state = recordVerification(state, firstReqs).state;

    const secondReqs = [makeReq('REQ-001', 'fail', 0), makeReq('REQ-002', 'fail', 0)];
    state = recordVerification(state, secondReqs).state;

    expect(isImproving(state)).toBe(false);
  });

  it('should require at least 1% increase (not less)', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 5 });

    // First: 50%
    const firstReqs = [makeReq('REQ-001', 'pass', 50)];
    state = recordVerification(state, firstReqs).state;

    // Second: 50% same — no improvement
    const secondReqs = [makeReq('REQ-001', 'pass', 50)];
    state = recordVerification(state, secondReqs).state;

    expect(isImproving(state)).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// formatVerificationResult
// ══════════════════════════════════════════════════

describe('formatVerificationResult', () => {
  it('should include iteration number', () => {
    const state = createLoop('feature');
    const reqs = [makeReq('REQ-001', 'pass', 100)];
    const { state: newState } = recordVerification(state, reqs);
    const result = newState.history[0];
    const formatted = formatVerificationResult(result, DEFAULT_VERIFICATION_CONFIG);

    expect(formatted).toContain('Iteration 1');
  });

  it('should show PASSED label when above threshold', () => {
    const state = createLoop('feature', { threshold: 90 });
    const reqs = [makeReq('REQ-001', 'pass', 100)];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], newState.config);

    expect(formatted).toContain('PASSED');
  });

  it('should show BELOW THRESHOLD label when below threshold', () => {
    const state = createLoop('feature', { threshold: 90 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], newState.config);

    expect(formatted).toContain('BELOW THRESHOLD');
  });

  it('should include requirement IDs and descriptions', () => {
    const state = createLoop('feature');
    const reqs = [makeReq('REQ-001', 'pass', 100, 'Must do X')];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], DEFAULT_VERIFICATION_CONFIG);

    expect(formatted).toContain('REQ-001');
    expect(formatted).toContain('Must do X');
  });

  it('should show pass icon for passing requirements', () => {
    const state = createLoop('feature');
    const reqs = [makeReq('REQ-001', 'pass', 100)];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], DEFAULT_VERIFICATION_CONFIG);

    expect(formatted).toContain('✅');
  });

  it('should show fail icon for failing requirements', () => {
    const state = createLoop('feature', { threshold: 100, maxIterations: 3 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], newState.config);

    expect(formatted).toContain('❌');
  });

  it('should show warning icon for partial requirements', () => {
    const state = createLoop('feature', { threshold: 100, maxIterations: 3 });
    const reqs = [makeReq('REQ-001', 'partial', 50)];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], newState.config);

    expect(formatted).toContain('⚠️');
  });

  it('should show skip icon for skipped requirements', () => {
    const state = createLoop('feature');
    const reqs = [makeReq('REQ-001', 'skip', 0)];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], DEFAULT_VERIFICATION_CONFIG);

    expect(formatted).toContain('⏭️');
  });

  it('should show summary counts', () => {
    const state = createLoop('feature', { threshold: 100, maxIterations: 3 });
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'fail', 0),
      makeReq('REQ-003', 'partial', 50),
      makeReq('REQ-004', 'skip', 0),
    ];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], newState.config);

    expect(formatted).toContain('1 pass');
    expect(formatted).toContain('1 fail');
    expect(formatted).toContain('1 partial');
    expect(formatted).toContain('1 skip');
  });

  it('should include evidence for failing requirements', () => {
    const state = createLoop('feature', { threshold: 100, maxIterations: 3 });
    const reqs = [makeReq('REQ-001', 'fail', 0, 'Req desc', 'Missing implementation')];
    const { state: newState } = recordVerification(state, reqs);
    const formatted = formatVerificationResult(newState.history[0], newState.config);

    expect(formatted).toContain('Missing implementation');
  });
});

// ══════════════════════════════════════════════════
// formatLoopSummary
// ══════════════════════════════════════════════════

describe('formatLoopSummary', () => {
  it('should include feature name', () => {
    const state = createLoop('my-feature');
    const formatted = formatLoopSummary(state);
    expect(formatted).toContain('my-feature');
  });

  it('should include status', () => {
    const state = createLoop('feature');
    const formatted = formatLoopSummary(state);
    expect(formatted).toContain('PENDING');
  });

  it('should show history when present', () => {
    let state = createLoop('feature', { threshold: 100, maxIterations: 5 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    state = recordVerification(state, reqs).state;
    const formatted = formatLoopSummary(state);

    expect(formatted).toContain('Iteration 1');
  });

  it('should show completion status when passed', () => {
    const state = createLoop('feature', { threshold: 0 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { state: doneState } = recordVerification(state, reqs);
    const formatted = formatLoopSummary(doneState);

    expect(formatted).toContain('PASSED');
  });

  it('should include threshold and iteration config', () => {
    const state = createLoop('feature', { threshold: 85, maxIterations: 5 });
    const formatted = formatLoopSummary(state);

    expect(formatted).toContain('85%');
    expect(formatted).toContain('5');
  });
});

// ══════════════════════════════════════════════════
// Edge cases
// ══════════════════════════════════════════════════

describe('edge cases', () => {
  it('should handle empty requirements gracefully (100% rate)', () => {
    const state = createLoop('feature', { threshold: 90 });
    const { action } = recordVerification(state, []);

    expect(action.type).toBe('passed');
    expect(action.rate).toBe(100);
  });

  it('should handle all-skipped requirements as passing', () => {
    const state = createLoop('feature', { threshold: 90 });
    const reqs = [
      makeReq('REQ-001', 'skip', 0),
      makeReq('REQ-002', 'skip', 0),
    ];
    const { action } = recordVerification(state, reqs);

    expect(action.type).toBe('passed');
    expect(action.rate).toBe(100);
  });

  it('should not mutate the original state', () => {
    const state = createLoop('feature', { threshold: 90, maxIterations: 3 });
    const originalHistory = state.history;
    const reqs = [makeReq('REQ-001', 'pass', 100)];

    recordVerification(state, reqs);

    expect(state.history).toBe(originalHistory);
    expect(state.history).toHaveLength(0);
    expect(state.status).toBe('pending');
  });

  it('should handle maxIterations of 1', () => {
    const state = createLoop('feature', { threshold: 100, maxIterations: 1 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { action } = recordVerification(state, reqs);

    expect(action.type).toBe('max_iterations');
  });

  it('should handle threshold of 0 (always passes)', () => {
    const state = createLoop('feature', { threshold: 0 });
    const reqs = [makeReq('REQ-001', 'fail', 0)];
    const { action } = recordVerification(state, reqs);

    expect(action.type).toBe('passed');
  });

  it('should handle threshold of 100 (requires perfect score)', () => {
    const state = createLoop('feature', { threshold: 100, maxIterations: 3 });
    const reqs = [
      makeReq('REQ-001', 'pass', 100),
      makeReq('REQ-002', 'fail', 0),
    ];
    const { action } = recordVerification(state, reqs);

    expect(action.type).toBe('retry');
  });
});
