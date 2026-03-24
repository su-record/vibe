/**
 * AutomationLevel — 자동화 레벨 시스템
 *
 * L0: Manual — 모든 단계에서 사용자 확인
 * L1: Guided — AI 제안, 사용자 결정
 * L2: Semi-auto — 기본값, 주요 지점에서 확인
 * L3: Auto — 자동 진행, 체크포인트만 확인 (ultrawork)
 * L4: Full-auto — 완전 자동, 달성률 기반 반복 (ralph)
 */

export type AutomationLevelNumber = 0 | 1 | 2 | 3 | 4;

export interface AutomationLevel {
  level: AutomationLevelNumber;
  name: string;
  description: string;
  /** Whether to auto-advance between phases */
  autoAdvance: boolean;
  /** Whether to auto-retry on failure */
  autoRetry: boolean;
  /** Max retries (0 = no retry) */
  maxRetries: number;
  /** Whether to require user confirmation at checkpoints */
  requireCheckpoints: boolean;
  /** Whether to use parallel agents */
  parallelAgents: boolean;
}

export type AutomationAction =
  | 'phase_advance'
  | 'architecture_choice'
  | 'implementation_scope'
  | 'fix_strategy'
  | 'retry'
  | 'destructive';

export interface TrustScore {
  score: number;
  level: AutomationLevelNumber;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalActions: number;
}

export const AUTOMATION_LEVELS: Record<AutomationLevelNumber, AutomationLevel> = {
  0: {
    level: 0,
    name: 'Manual',
    description: 'Every step requires user confirmation',
    autoAdvance: false,
    autoRetry: false,
    maxRetries: 0,
    requireCheckpoints: true,
    parallelAgents: false,
  },
  1: {
    level: 1,
    name: 'Guided',
    description: 'AI suggests, user decides',
    autoAdvance: false,
    autoRetry: false,
    maxRetries: 0,
    requireCheckpoints: true,
    parallelAgents: false,
  },
  2: {
    level: 2,
    name: 'Semi-auto',
    description: 'Auto-execute with key checkpoints',
    autoAdvance: true,
    autoRetry: true,
    maxRetries: 2,
    requireCheckpoints: true,
    parallelAgents: false,
  },
  3: {
    level: 3,
    name: 'Auto',
    description: 'Auto-advance, checkpoint-only review',
    autoAdvance: true,
    autoRetry: true,
    maxRetries: 3,
    requireCheckpoints: true,
    parallelAgents: true,
  },
  4: {
    level: 4,
    name: 'Full-auto',
    description: 'Fully autonomous, metric-driven iteration',
    autoAdvance: true,
    autoRetry: true,
    maxRetries: 5,
    requireCheckpoints: false,
    parallelAgents: true,
  },
};

/** Magic keyword → level mapping */
export const KEYWORD_LEVEL_MAP: Record<string, AutomationLevelNumber> = {
  manual: 0,
  guided: 1,
  quick: 2,
  ultrawork: 3,
  ulw: 3,
  ralph: 4,
  ralplan: 4,
  verify: 1,
};

const CONFIRMATION_MATRIX: Record<AutomationAction, readonly AutomationLevelNumber[]> = {
  destructive: [0, 1, 2, 3],
  phase_advance: [0, 1],
  architecture_choice: [0, 1, 2],
  implementation_scope: [0, 1, 2],
  fix_strategy: [0, 1],
  retry: [0],
};

const TRUST_SCORE_DEFAULTS = {
  INITIAL: 50,
  SUCCESS_DELTA: 5,
  FAILURE_DELTA: 15,
  MAX: 100,
  MIN: 0,
} as const;

const TRUST_LEVEL_THRESHOLDS: Array<{ max: number; level: AutomationLevelNumber }> = [
  { max: 20, level: 0 },
  { max: 40, level: 1 },
  { max: 60, level: 2 },
  { max: 80, level: 3 },
  { max: 100, level: 4 },
];

/** Detect automation level from user input text */
export function detectAutomationLevel(input: string): AutomationLevel {
  const lower = input.toLowerCase();
  for (const [keyword, levelNum] of Object.entries(KEYWORD_LEVEL_MAP)) {
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(lower)) {
      return AUTOMATION_LEVELS[levelNum];
    }
  }
  return AUTOMATION_LEVELS[2];
}

/** Get level by number */
export function getAutomationLevel(level: AutomationLevelNumber): AutomationLevel {
  return AUTOMATION_LEVELS[level];
}

/** Check if a specific action needs user confirmation at the given level */
export function needsConfirmation(
  level: AutomationLevelNumber,
  action: AutomationAction,
): boolean {
  return (CONFIRMATION_MATRIX[action] as readonly number[]).includes(level);
}

export function createTrustScore(): TrustScore {
  return {
    score: TRUST_SCORE_DEFAULTS.INITIAL,
    level: 2,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
    totalActions: 0,
  };
}

export function recordTrustSuccess(trust: TrustScore): TrustScore {
  const score = Math.min(
    TRUST_SCORE_DEFAULTS.MAX,
    trust.score + TRUST_SCORE_DEFAULTS.SUCCESS_DELTA,
  );
  const updated: TrustScore = {
    score,
    level: scorToLevel(score),
    consecutiveSuccesses: trust.consecutiveSuccesses + 1,
    consecutiveFailures: 0,
    totalActions: trust.totalActions + 1,
  };
  return updated;
}

export function recordTrustFailure(trust: TrustScore): TrustScore {
  const score = Math.max(
    TRUST_SCORE_DEFAULTS.MIN,
    trust.score - TRUST_SCORE_DEFAULTS.FAILURE_DELTA,
  );
  const updated: TrustScore = {
    score,
    level: scorToLevel(score),
    consecutiveSuccesses: 0,
    consecutiveFailures: trust.consecutiveFailures + 1,
    totalActions: trust.totalActions + 1,
  };
  return updated;
}

/** Get recommended level based on trust score */
export function getRecommendedLevel(trust: TrustScore): AutomationLevelNumber {
  return scorToLevel(trust.score);
}

function scorToLevel(score: number): AutomationLevelNumber {
  for (const { max, level } of TRUST_LEVEL_THRESHOLDS) {
    if (score <= max) {
      return level;
    }
  }
  return 4;
}
