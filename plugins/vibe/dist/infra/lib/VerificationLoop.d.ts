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
export interface E2ECheckConfig {
    /** 검증 대상 URL (e.g., http://localhost:3000) */
    baseURL: string;
    /** 검증할 경로 목록 */
    routes: string[];
    /** 뷰포트 크기 (기본: 1920x1080) */
    viewport?: {
        width: number;
        height: number;
    };
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
export declare const DEFAULT_VERIFICATION_CONFIG: VerificationLoopConfig;
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
export type VerificationAction = {
    type: 'passed';
    rate: number;
} | {
    type: 'retry';
    rate: number;
    iteration: number;
    failedRequirements: RequirementResult[];
} | {
    type: 'max_iterations';
    rate: number;
    history: VerificationResult[];
};
/**
 * Create a new verification loop
 */
export declare function createLoop(feature: string, config?: Partial<VerificationLoopConfig>): LoopState;
/**
 * Calculate achievement rate from requirement results
 * Weighted average of scores; skip items are excluded
 */
export declare function calculateAchievementRate(requirements: RequirementResult[]): number;
/**
 * Record a verification result and determine next action
 */
export declare function recordVerification(state: LoopState, requirements: RequirementResult[]): {
    state: LoopState;
    action: VerificationAction;
};
/**
 * Get failed/partial requirements from a result
 */
export declare function getUnmetRequirements(result: VerificationResult): RequirementResult[];
/**
 * Format verification result as readable string
 */
export declare function formatVerificationResult(result: VerificationResult, config: VerificationLoopConfig): string;
/**
 * Format loop summary
 */
export declare function formatLoopSummary(state: LoopState): string;
/**
 * Check if improvement is being made (rate increasing across iterations)
 * Returns true if latest rate is at least 1% higher than the previous
 */
export declare function isImproving(state: LoopState): boolean;
/**
 * 단일 URL에 대해 E2E 브라우저 검증 수행
 * browser/ 인프라의 Puppeteer 모듈을 동적 임포트 (puppeteer 미설치 시 graceful skip)
 */
export declare function runE2ECheck(url: string, config: E2ECheckConfig): Promise<E2ECheckResult>;
/**
 * E2E 검증 전체 실행 — 모든 라우트에 대해 브라우저 검증
 */
export declare function runE2EVerification(config: E2ECheckConfig): Promise<E2EVerificationResult>;
/**
 * E2E 검증 결과를 RequirementResult로 변환
 * VerificationLoop와 통합하여 SPEC 달성률에 반영
 */
export declare function e2eToRequirements(e2eResult: E2EVerificationResult): RequirementResult[];
/**
 * E2E 검증 결과 포맷팅
 */
export declare function formatE2EResult(result: E2EVerificationResult): string;
//# sourceMappingURL=VerificationLoop.d.ts.map