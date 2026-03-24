/**
 * VerificationLoop — SPEC 요구사항 달성률 정량화 + 자동 반복
 *
 * /vibe.trace 결과를 정량화하고, 임계값 미달 시 자동 재시도 지원
 */

export interface RequirementResult {
  /** Requirement ID (e.g., REQ-001) */
  id: string;
  /** Requirement description */
  description: string;
  /** Achievement status */
  status: 'pass' | 'fail' | 'partial' | 'skip';
  /** Achievement score 0-100 */
  score: number;
  /** Evidence or reason */
  evidence: string;
}

export interface VerificationResult {
  /** Overall achievement rate 0-100 */
  achievementRate: number;
  /** Individual requirement results */
  requirements: RequirementResult[];
  /** Count by status */
  summary: {
    total: number;
    pass: number;
    fail: number;
    partial: number;
    skip: number;
  };
  /** Timestamp */
  timestamp: string;
  /** Iteration number (1-based) */
  iteration: number;
}

export interface VerificationLoopConfig {
  /** Achievement threshold to pass (default: 90) */
  threshold: number;
  /** Max iterations (default: 3) */
  maxIterations: number;
  /** Whether auto-retry is enabled */
  autoRetry: boolean;
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationLoopConfig = {
  threshold: 90,
  maxIterations: 3,
  autoRetry: false,
};

export interface LoopState {
  /** Feature/SPEC name */
  feature: string;
  /** Configuration */
  config: VerificationLoopConfig;
  /** History of verification results */
  history: VerificationResult[];
  /** Current status */
  status: 'pending' | 'running' | 'passed' | 'failed' | 'max_iterations';
  /** Started at */
  startedAt: string;
  /** Completed at */
  completedAt?: string;
}

export type VerificationAction =
  | { type: 'passed'; rate: number }
  | { type: 'retry'; rate: number; iteration: number; failedRequirements: RequirementResult[] }
  | { type: 'max_iterations'; rate: number; history: VerificationResult[] };

/**
 * Create a new verification loop
 */
export function createLoop(feature: string, config?: Partial<VerificationLoopConfig>): LoopState {
  return {
    feature,
    config: { ...DEFAULT_VERIFICATION_CONFIG, ...config },
    history: [],
    status: 'pending',
    startedAt: new Date().toISOString(),
  };
}

/**
 * Calculate achievement rate from requirement results
 * Weighted average of scores; skip items are excluded
 */
export function calculateAchievementRate(requirements: RequirementResult[]): number {
  const active = requirements.filter(r => r.status !== 'skip');
  if (active.length === 0) return 100;
  const total = active.reduce((sum, r) => sum + r.score, 0);
  return Math.round(total / active.length);
}

/**
 * Build summary counts from requirement results
 */
function buildSummary(requirements: RequirementResult[]): VerificationResult['summary'] {
  return {
    total: requirements.length,
    pass: requirements.filter(r => r.status === 'pass').length,
    fail: requirements.filter(r => r.status === 'fail').length,
    partial: requirements.filter(r => r.status === 'partial').length,
    skip: requirements.filter(r => r.status === 'skip').length,
  };
}

/**
 * Determine the next action based on current state
 */
function determineAction(state: LoopState, result: VerificationResult): VerificationAction {
  if (result.achievementRate >= state.config.threshold) {
    return { type: 'passed', rate: result.achievementRate };
  }

  const nextIteration = state.history.length;
  if (nextIteration >= state.config.maxIterations) {
    return { type: 'max_iterations', rate: result.achievementRate, history: state.history };
  }

  return {
    type: 'retry',
    rate: result.achievementRate,
    iteration: nextIteration,
    failedRequirements: getUnmetRequirements(result),
  };
}

/**
 * Record a verification result and determine next action
 */
export function recordVerification(
  state: LoopState,
  requirements: RequirementResult[]
): { state: LoopState; action: VerificationAction } {
  const iteration = state.history.length + 1;
  const achievementRate = calculateAchievementRate(requirements);

  const result: VerificationResult = {
    achievementRate,
    requirements,
    summary: buildSummary(requirements),
    timestamp: new Date().toISOString(),
    iteration,
  };

  const newHistory = [...state.history, result];
  const action = determineAction({ ...state, history: newHistory }, result);

  const nextStatus = resolveStatus(action.type);
  const completedAt = nextStatus !== 'running' ? new Date().toISOString() : undefined;

  const newState: LoopState = {
    ...state,
    history: newHistory,
    status: nextStatus,
    ...(completedAt && { completedAt }),
  };

  return { state: newState, action };
}

/**
 * Map action type to loop status
 */
function resolveStatus(actionType: VerificationAction['type']): LoopState['status'] {
  switch (actionType) {
    case 'passed': return 'passed';
    case 'max_iterations': return 'max_iterations';
    case 'retry': return 'running';
  }
}

/**
 * Get failed/partial requirements from a result
 */
export function getUnmetRequirements(result: VerificationResult): RequirementResult[] {
  return result.requirements.filter(r => r.status === 'fail' || r.status === 'partial');
}

/**
 * Get status icon for a requirement result
 */
function getRequirementIcon(status: RequirementResult['status']): string {
  switch (status) {
    case 'pass': return '✅';
    case 'fail': return '❌';
    case 'partial': return '⚠️';
    case 'skip': return '⏭️';
  }
}

/**
 * Build a visual progress bar (e.g., "████████░░ 80%")
 */
function buildRateBar(rate: number, width: number = 10): string {
  const filled = Math.round((rate / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${rate}%`;
}

/**
 * Format verification result as readable string
 */
export function formatVerificationResult(
  result: VerificationResult,
  config: VerificationLoopConfig
): string {
  const lines: string[] = [];
  const passed = result.achievementRate >= config.threshold;
  const statusLabel = passed ? 'PASSED' : 'BELOW THRESHOLD';

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Verification Result — Iteration ${result.iteration}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Achievement: ${buildRateBar(result.achievementRate)} [${statusLabel}]`);
  lines.push(`Threshold:   ${config.threshold}%`);
  lines.push(`Summary:     ${result.summary.pass} pass / ${result.summary.fail} fail / ${result.summary.partial} partial / ${result.summary.skip} skip`);
  lines.push(``);
  lines.push(`Requirements:`);

  for (const req of result.requirements) {
    const icon = getRequirementIcon(req.status);
    lines.push(`  ${icon} [${req.id}] ${req.description}`);
    if (req.status !== 'pass' && req.status !== 'skip') {
      lines.push(`       Evidence: ${req.evidence}`);
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * Format loop summary
 */
export function formatLoopSummary(state: LoopState): string {
  const lines: string[] = [];

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Verification Loop — ${state.feature}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Status:     ${state.status.toUpperCase()}`);
  lines.push(`Iterations: ${state.history.length}/${state.config.maxIterations}`);
  lines.push(`Threshold:  ${state.config.threshold}%`);
  lines.push(`Auto-retry: ${state.config.autoRetry ? 'enabled' : 'disabled'}`);

  if (state.history.length > 0) {
    lines.push(``);
    lines.push(`History:`);
    for (const result of state.history) {
      const bar = buildRateBar(result.achievementRate, 8);
      lines.push(`  Iteration ${result.iteration}: ${bar}`);
    }

    const improving = isImproving(state) ? ' (improving)' : '';
    lines.push(`${improving}`);
  }

  if (state.completedAt) {
    lines.push(``);
    lines.push(`Completed: ${state.completedAt}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * Check if improvement is being made (rate increasing across iterations)
 * Returns true if latest rate is at least 1% higher than the previous
 */
export function isImproving(state: LoopState): boolean {
  if (state.history.length < 2) return false;

  const last = state.history[state.history.length - 1];
  const prev = state.history[state.history.length - 2];

  return last.achievementRate - prev.achievementRate >= 1;
}
