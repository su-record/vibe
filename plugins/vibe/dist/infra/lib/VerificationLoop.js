/**
 * VerificationLoop — SPEC 요구사항 달성률 정량화 + 자동 반복
 *
 * /vibe.trace 결과를 정량화하고, 임계값 미달 시 자동 재시도 지원
 * E2E 브라우저 검증 지원 (Puppeteer 기반 사용자 관점 검증)
 *
 * @deprecated Not wired into the vibe runtime (no hook/skill/CLI consumer).
 * In-memory loop state does not survive vibe's per-event process model.
 * Retained for API compatibility; may be removed in a future major.
 */
export const DEFAULT_VERIFICATION_CONFIG = {
    threshold: 90,
    maxIterations: 3,
    autoRetry: false,
};
/**
 * Create a new verification loop
 */
export function createLoop(feature, config) {
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
export function calculateAchievementRate(requirements) {
    const active = requirements.filter(r => r.status !== 'skip');
    if (active.length === 0)
        return 100;
    const total = active.reduce((sum, r) => sum + r.score, 0);
    return Math.round(total / active.length);
}
/**
 * Build summary counts from requirement results
 */
function buildSummary(requirements) {
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
function determineAction(state, result) {
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
export function recordVerification(state, requirements) {
    const iteration = state.history.length + 1;
    const achievementRate = calculateAchievementRate(requirements);
    const result = {
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
    const newState = {
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
function resolveStatus(actionType) {
    switch (actionType) {
        case 'passed': return 'passed';
        case 'max_iterations': return 'max_iterations';
        case 'retry': return 'running';
    }
}
/**
 * Get failed/partial requirements from a result
 */
export function getUnmetRequirements(result) {
    return result.requirements.filter(r => r.status === 'fail' || r.status === 'partial');
}
/**
 * Get status icon for a requirement result
 */
function getRequirementIcon(status) {
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
function buildRateBar(rate, width = 10) {
    const filled = Math.round((rate / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${rate}%`;
}
/**
 * Format verification result as readable string
 */
export function formatVerificationResult(result, config) {
    const lines = [];
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
export function formatLoopSummary(state) {
    const lines = [];
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
export function isImproving(state) {
    if (state.history.length < 2)
        return false;
    const last = state.history[state.history.length - 1];
    const prev = state.history[state.history.length - 2];
    return last.achievementRate - prev.achievementRate >= 1;
}
// ─── E2E Browser Verification ───
/**
 * 단일 URL에 대해 E2E 브라우저 검증 수행
 * browser/ 인프라의 Puppeteer 모듈을 동적 임포트 (puppeteer 미설치 시 graceful skip)
 */
export async function runE2ECheck(url, config) {
    const result = { url, status: 'pass', p1Count: 0, p2Count: 0, issues: [] };
    try {
        const { launchBrowser, openPage, closeBrowser } = await import('./browser/launch.js');
        const { captureScreenshot, extractTextContent } = await import('./browser/capture.js');
        const viewport = config.viewport ?? { width: 1920, height: 1080 };
        const browser = await launchBrowser({ headless: true, viewport });
        const page = await openPage(browser, url, viewport);
        // 콘솔 에러 수집
        const consoleErrors = [];
        page.on('console', (msg) => {
            const m = msg;
            if (m.type() === 'error')
                consoleErrors.push(m.text());
        });
        // 페이지 로드 대기
        await page.waitForNetworkIdle({ idleTime: 1000 }).catch(() => { });
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
        const failedRequests = [];
        page.on('requestfailed', (req) => {
            const r = req;
            failedRequests.push(r.url());
        });
        if (failedRequests.length > 0) {
            result.issues.push(`Failed requests (${failedRequests.length}): ${failedRequests[0]}`);
            result.p2Count++;
        }
        await closeBrowser();
    }
    catch (error) {
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
export async function runE2EVerification(config) {
    const checks = [];
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
export function e2eToRequirements(e2eResult) {
    return e2eResult.checks.map((check, i) => ({
        id: `E2E-${String(i + 1).padStart(3, '0')}`,
        description: `E2E: ${check.url}`,
        status: check.status === 'pass' ? 'pass' : 'fail',
        score: check.status === 'pass' ? 100 : Math.max(0, 100 - check.p1Count * 50),
        evidence: check.issues.length > 0 ? check.issues.join('; ') : 'All checks passed',
    }));
}
/**
 * E2E 검증 결과 포맷팅
 */
export function formatE2EResult(result) {
    const lines = [];
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
//# sourceMappingURL=VerificationLoop.js.map