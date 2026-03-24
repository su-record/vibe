import { describe, it, expect } from 'vitest';
import {
  AUTOMATION_LEVELS,
  KEYWORD_LEVEL_MAP,
  detectAutomationLevel,
  getAutomationLevel,
  needsConfirmation,
  createTrustScore,
  recordTrustSuccess,
  recordTrustFailure,
  getRecommendedLevel,
  type AutomationLevelNumber,
  type AutomationAction,
} from '../AutomationLevel.js';

describe('AUTOMATION_LEVELS', () => {
  it('defines all 5 levels (0-4)', () => {
    const keys = Object.keys(AUTOMATION_LEVELS).map(Number);
    expect(keys).toEqual([0, 1, 2, 3, 4]);
  });

  it('L0 Manual has no auto behavior', () => {
    const l0 = AUTOMATION_LEVELS[0];
    expect(l0.autoAdvance).toBe(false);
    expect(l0.autoRetry).toBe(false);
    expect(l0.maxRetries).toBe(0);
    expect(l0.parallelAgents).toBe(false);
    expect(l0.requireCheckpoints).toBe(true);
  });

  it('L4 Full-auto has full auto behavior', () => {
    const l4 = AUTOMATION_LEVELS[4];
    expect(l4.autoAdvance).toBe(true);
    expect(l4.autoRetry).toBe(true);
    expect(l4.maxRetries).toBe(5);
    expect(l4.parallelAgents).toBe(true);
    expect(l4.requireCheckpoints).toBe(false);
  });

  it('L3 Auto enables parallel agents', () => {
    expect(AUTOMATION_LEVELS[3].parallelAgents).toBe(true);
  });

  it('L2 Semi-auto has maxRetries 2', () => {
    expect(AUTOMATION_LEVELS[2].maxRetries).toBe(2);
  });

  it('each level has the correct level number field', () => {
    (([0, 1, 2, 3, 4] as AutomationLevelNumber[])).forEach((n) => {
      expect(AUTOMATION_LEVELS[n].level).toBe(n);
    });
  });
});

describe('KEYWORD_LEVEL_MAP', () => {
  it('maps ultrawork and ulw to L3', () => {
    expect(KEYWORD_LEVEL_MAP['ultrawork']).toBe(3);
    expect(KEYWORD_LEVEL_MAP['ulw']).toBe(3);
  });

  it('maps ralph and ralplan to L4', () => {
    expect(KEYWORD_LEVEL_MAP['ralph']).toBe(4);
    expect(KEYWORD_LEVEL_MAP['ralplan']).toBe(4);
  });

  it('maps quick to L2', () => {
    expect(KEYWORD_LEVEL_MAP['quick']).toBe(2);
  });

  it('maps verify and guided to L1', () => {
    expect(KEYWORD_LEVEL_MAP['verify']).toBe(1);
    expect(KEYWORD_LEVEL_MAP['guided']).toBe(1);
  });

  it('maps manual to L0', () => {
    expect(KEYWORD_LEVEL_MAP['manual']).toBe(0);
  });
});

describe('detectAutomationLevel', () => {
  it('detects ultrawork keyword', () => {
    const level = detectAutomationLevel('please ultrawork this feature');
    expect(level.level).toBe(3);
  });

  it('detects ulw shorthand', () => {
    expect(detectAutomationLevel('ulw build the module').level).toBe(3);
  });

  it('detects ralph keyword', () => {
    expect(detectAutomationLevel('ralph until done').level).toBe(4);
  });

  it('detects ralplan keyword', () => {
    expect(detectAutomationLevel('ralplan the architecture').level).toBe(4);
  });

  it('detects quick keyword', () => {
    expect(detectAutomationLevel('quick fix this bug').level).toBe(2);
  });

  it('detects verify keyword', () => {
    expect(detectAutomationLevel('verify all tests').level).toBe(1);
  });

  it('detects manual keyword', () => {
    expect(detectAutomationLevel('manual review needed').level).toBe(0);
  });

  it('returns L2 as default when no keyword matches', () => {
    expect(detectAutomationLevel('build the login feature').level).toBe(2);
  });

  it('is case-insensitive', () => {
    expect(detectAutomationLevel('ULTRAWORK this').level).toBe(3);
    expect(detectAutomationLevel('Ralph mode').level).toBe(4);
  });

  it('does not match partial words', () => {
    // "manually" should not match "manual"
    const result = detectAutomationLevel('manually check this');
    expect(result.level).toBe(2);
  });

  it('returns a full AutomationLevel object', () => {
    const level = detectAutomationLevel('ralph iterate');
    expect(level).toHaveProperty('name');
    expect(level).toHaveProperty('autoAdvance');
    expect(level).toHaveProperty('parallelAgents');
  });
});

describe('getAutomationLevel', () => {
  it('returns correct level for each number', () => {
    ([0, 1, 2, 3, 4] as AutomationLevelNumber[]).forEach((n) => {
      const level = getAutomationLevel(n);
      expect(level.level).toBe(n);
    });
  });

  it('returns L2 as Semi-auto', () => {
    expect(getAutomationLevel(2).name).toBe('Semi-auto');
  });
});

describe('needsConfirmation', () => {
  describe('destructive action', () => {
    it('requires confirmation at L0-L3', () => {
      ([0, 1, 2, 3] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'destructive')).toBe(true);
      });
    });

    it('does not require confirmation at L4', () => {
      expect(needsConfirmation(4, 'destructive')).toBe(false);
    });
  });

  describe('phase_advance action', () => {
    it('requires confirmation at L0-L1', () => {
      expect(needsConfirmation(0, 'phase_advance')).toBe(true);
      expect(needsConfirmation(1, 'phase_advance')).toBe(true);
    });

    it('does not require confirmation at L2+', () => {
      ([2, 3, 4] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'phase_advance')).toBe(false);
      });
    });
  });

  describe('architecture_choice action', () => {
    it('requires confirmation at L0-L2', () => {
      ([0, 1, 2] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'architecture_choice')).toBe(true);
      });
    });

    it('does not require confirmation at L3+', () => {
      ([3, 4] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'architecture_choice')).toBe(false);
      });
    });
  });

  describe('implementation_scope action', () => {
    it('requires confirmation at L0-L2', () => {
      ([0, 1, 2] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'implementation_scope')).toBe(true);
      });
    });

    it('does not require confirmation at L3+', () => {
      ([3, 4] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'implementation_scope')).toBe(false);
      });
    });
  });

  describe('fix_strategy action', () => {
    it('requires confirmation at L0-L1', () => {
      expect(needsConfirmation(0, 'fix_strategy')).toBe(true);
      expect(needsConfirmation(1, 'fix_strategy')).toBe(true);
    });

    it('does not require confirmation at L2+', () => {
      ([2, 3, 4] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'fix_strategy')).toBe(false);
      });
    });
  });

  describe('retry action', () => {
    it('requires confirmation only at L0', () => {
      expect(needsConfirmation(0, 'retry')).toBe(true);
    });

    it('does not require confirmation at L1+', () => {
      ([1, 2, 3, 4] as AutomationLevelNumber[]).forEach((n) => {
        expect(needsConfirmation(n, 'retry')).toBe(false);
      });
    });
  });
});

describe('TrustScore', () => {
  describe('createTrustScore', () => {
    it('starts at score 50', () => {
      const trust = createTrustScore();
      expect(trust.score).toBe(50);
    });

    it('starts at L2', () => {
      const trust = createTrustScore();
      expect(trust.level).toBe(2);
    });

    it('starts with zero counters', () => {
      const trust = createTrustScore();
      expect(trust.consecutiveSuccesses).toBe(0);
      expect(trust.consecutiveFailures).toBe(0);
      expect(trust.totalActions).toBe(0);
    });
  });

  describe('recordTrustSuccess', () => {
    it('increases score by 5', () => {
      const trust = createTrustScore();
      const updated = recordTrustSuccess(trust);
      expect(updated.score).toBe(55);
    });

    it('increments consecutiveSuccesses', () => {
      const trust = createTrustScore();
      const updated = recordTrustSuccess(trust);
      expect(updated.consecutiveSuccesses).toBe(1);
    });

    it('resets consecutiveFailures to 0', () => {
      const trust = { ...createTrustScore(), consecutiveFailures: 3 };
      const updated = recordTrustSuccess(trust);
      expect(updated.consecutiveFailures).toBe(0);
    });

    it('increments totalActions', () => {
      const trust = createTrustScore();
      const updated = recordTrustSuccess(trust);
      expect(updated.totalActions).toBe(1);
    });

    it('caps score at 100', () => {
      let trust = createTrustScore();
      for (let i = 0; i < 20; i++) {
        trust = recordTrustSuccess(trust);
      }
      expect(trust.score).toBe(100);
    });

    it('updates level when score crosses threshold', () => {
      let trust = createTrustScore();
      // score 50 → L2; after enough successes score 81+ → L4
      for (let i = 0; i < 7; i++) {
        trust = recordTrustSuccess(trust);
      }
      // 50 + 7*5 = 85 → L4
      expect(trust.score).toBe(85);
      expect(trust.level).toBe(4);
    });

    it('does not mutate the original trust object', () => {
      const trust = createTrustScore();
      recordTrustSuccess(trust);
      expect(trust.score).toBe(50);
    });
  });

  describe('recordTrustFailure', () => {
    it('decreases score by 15', () => {
      const trust = createTrustScore();
      const updated = recordTrustFailure(trust);
      expect(updated.score).toBe(35);
    });

    it('increments consecutiveFailures', () => {
      const trust = createTrustScore();
      const updated = recordTrustFailure(trust);
      expect(updated.consecutiveFailures).toBe(1);
    });

    it('resets consecutiveSuccesses to 0', () => {
      const trust = { ...createTrustScore(), consecutiveSuccesses: 5 };
      const updated = recordTrustFailure(trust);
      expect(updated.consecutiveSuccesses).toBe(0);
    });

    it('increments totalActions', () => {
      const trust = createTrustScore();
      const updated = recordTrustFailure(trust);
      expect(updated.totalActions).toBe(1);
    });

    it('floors score at 0', () => {
      let trust = createTrustScore();
      for (let i = 0; i < 10; i++) {
        trust = recordTrustFailure(trust);
      }
      expect(trust.score).toBe(0);
    });

    it('updates level down when score drops', () => {
      const trust = createTrustScore(); // score 50, L2
      const updated = recordTrustFailure(trust); // score 35 → L1
      expect(updated.level).toBe(1);
    });

    it('does not mutate the original trust object', () => {
      const trust = createTrustScore();
      recordTrustFailure(trust);
      expect(trust.score).toBe(50);
    });
  });

  describe('getRecommendedLevel', () => {
    const cases: Array<[number, AutomationLevelNumber]> = [
      [0, 0],
      [10, 0],
      [20, 0],
      [21, 1],
      [40, 1],
      [41, 2],
      [60, 2],
      [61, 3],
      [80, 3],
      [81, 4],
      [100, 4],
    ];

    it.each(cases)('score %i → L%i', (score, expectedLevel) => {
      const trust = { ...createTrustScore(), score };
      expect(getRecommendedLevel(trust)).toBe(expectedLevel);
    });
  });
});
