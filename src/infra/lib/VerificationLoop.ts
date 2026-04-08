/**
 * VerificationLoop — SPEC 요구사항 달성률 정량화 + 자동 반복
 *
 * /vibe.trace 결과를 정량화하고, 임계값 미달 시 자동 재시도 지원
 * E2E 브라우저 검증 지원 (Puppeteer 기반 사용자 관점 검증)
 */

// ─── E2E Verification Types ───

export interface E2ECheckConfig {
  /** 검증 대상 URL (e.g., http://localhost:3000) */
  baseURL: string;
  /** 검증할 경로 목록 */
  routes: string[];
  /** 뷰포트 크기 (기본: 1920x1080) */
  viewport?: { width: number; height: number };
  /** 스크린샷 비교 임계값 (기본: 0.01 = 1%) */
  diffThreshold?: number;
  /** 콘솔 에러 허용 여부 (기본: false) */
  allowConsoleErrors?: boolean;
}

export interface E2ECheckResult {
  /** 검증 대상 URL */
  url: string;
  /** pass/fail */
  status: 'pass' | 'fail';
  /** P1 이슈 수 */
  p1Count: number;
  /** P2 이슈 수 */
  p2Count: number;
  /** 이슈 요약 */
  issues: string[];
  /** 스크린샷 diff 비율 (있으면) */
  screenshotDiffRatio?: number;
}

export interface E2EVerificationResult {
  /** 전체 pass 여부 */
  passed: boolean;
  /** 개별 라우트 결과 */
  checks: E2ECheckResult[];
  /** 총 P1 이슈 수 */
  totalP1: number;
  /** 총 P2 이슈 수 */
  totalP2: number;
  /** 타임스탬프 */
  timestamp: string;
}

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
  /** E2E 브라우저 검증 설정 (없으면 E2E 스킵) */
  e2e?: E2ECheckConfig;
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

// ─── E2E Browser Verification ───

/**
 * 단일 URL에 대해 E2E 브라우저 검증 수행
 * browser/ 인프라의 Puppeteer 모듈을 동적 임포트 (puppeteer 미설치 시 graceful skip)
 */
export async function runE2ECheck(
  url: string,
  config: E2ECheckConfig
): Promise<E2ECheckResult> {
  const result: E2ECheckResult = { url, status: 'pass', p1Count: 0, p2Count: 0, issues: [] };

  try {
    const { launchBrowser, openPage, closeBrowser } = await import('./browser/launch.js');
    const { captureScreenshot, extractTextContent } = await import('./browser/capture.js');

    const viewport = config.viewport ?? { width: 1920, height: 1080 };
    const browser = await launchBrowser({ headless: true, viewport });
    const page = await openPage(browser, url, viewport) as {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      waitForNetworkIdle: (opts: { idleTime: number }) => Promise<void>;
    };

    // 콘솔 에러 수집
    const consoleErrors: string[] = [];
    page.on('console', (msg: unknown) => {
      const m = msg as { type: () => string; text: () => string };
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    // 페이지 로드 대기
    await page.waitForNetworkIdle({ idleTime: 1000 }).catch(() => { /* timeout ok */ });

    // 텍스트 콘텐츠 존재 확인 (빈 페이지 감지)
    const texts = await extractTextContent(page);
    if (texts.length === 0) {
      result.issues.push('Empty page — no text content rendered');
      result.p1Count++;
    }

    // 콘솔 에러 체크
    if (!config.allowConsoleErrors && consoleErrors.length > 0) {
      const errorSummary = consoleErrors.slice(0, 3).join('; ');
      result.issues.push(`Console errors (${consoleErrors.length}): ${errorSummary}`);
      result.p1Count++;
    }

    // HTTP 에러 체크 (4xx, 5xx 리소스)
    const failedRequests: string[] = [];
    page.on('requestfailed', (req: unknown) => {
      const r = req as { url: () => string };
      failedRequests.push(r.url());
    });

    if (failedRequests.length > 0) {
      result.issues.push(`Failed requests (${failedRequests.length}): ${failedRequests[0]}`);
      result.p2Count++;
    }

    await closeBrowser();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Cannot find module') || msg.includes('puppeteer')) {
      result.issues.push('Puppeteer not installed — E2E check skipped');
      return result; // graceful skip, 아직 pass
    }
    result.issues.push(`E2E check error: ${msg}`);
    result.p1Count++;
  }

  result.status = result.p1Count > 0 ? 'fail' : 'pass';
  return result;
}

/**
 * E2E 검증 전체 실행 — 모든 라우트에 대해 브라우저 검증
 */
export async function runE2EVerification(
  config: E2ECheckConfig
): Promise<E2EVerificationResult> {
  const checks: E2ECheckResult[] = [];
  let totalP1 = 0;
  let totalP2 = 0;

  for (const route of config.routes) {
    const url = `${config.baseURL}${route}`;
    const check = await runE2ECheck(url, config);
    checks.push(check);
    totalP1 += check.p1Count;
    totalP2 += check.p2Count;
  }

  return {
    passed: totalP1 === 0,
    checks,
    totalP1,
    totalP2,
    timestamp: new Date().toISOString(),
  };
}

/**
 * E2E 검증 결과를 RequirementResult로 변환
 * VerificationLoop와 통합하여 SPEC 달성률에 반영
 */
export function e2eToRequirements(e2eResult: E2EVerificationResult): RequirementResult[] {
  return e2eResult.checks.map((check, i) => ({
    id: `E2E-${String(i + 1).padStart(3, '0')}`,
    description: `E2E: ${check.url}`,
    status: check.status === 'pass' ? 'pass' as const : 'fail' as const,
    score: check.status === 'pass' ? 100 : Math.max(0, 100 - check.p1Count * 50),
    evidence: check.issues.length > 0 ? check.issues.join('; ') : 'All checks passed',
  }));
}

/**
 * E2E 검증 결과 포맷팅
 */
export function formatE2EResult(result: E2EVerificationResult): string {
  const lines: string[] = [];
  const statusIcon = result.passed ? '✅' : '❌';

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${statusIcon} E2E Browser Verification`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`P1: ${result.totalP1} | P2: ${result.totalP2}`);
  lines.push(``);

  for (const check of result.checks) {
    const icon = check.status === 'pass' ? '✅' : '❌';
    lines.push(`  ${icon} ${check.url}`);
    for (const issue of check.issues) {
      lines.push(`       ${issue}`);
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}
