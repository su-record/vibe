/**
 * Iteration Tracker for ULTRAWORK/Ralph Loop
 * 작업 진행 상황을 추적하고 표시
 *
 * Also provides disk-based progress persistence (merged from ProgressTracker).
 */
import { LoopBreaker } from './LoopBreaker.js';
export interface PhaseInfo {
    id: number;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    startedAt?: string;
    completedAt?: string;
    blockers?: string[];
}
export interface ProgressState {
    feature: string;
    spec: string;
    status: 'pending' | 'in_progress' | 'blocked' | 'completed';
    currentPhase: number;
    totalPhases: number;
    phases: PhaseInfo[];
    completedTasks: string[];
    pendingTasks: string[];
    blockers: string[];
    lastCommit?: string;
    lastUpdated: string;
    startedAt: string;
    sessionCount: number;
}
export declare function getProgressPath(projectRoot: string): string;
export declare function loadProgress(projectRoot: string): ProgressState | null;
export declare function saveProgress(projectRoot: string, progress: ProgressState): void;
export declare function initProgress(projectRoot: string, feature: string, spec: string, phases: string[]): ProgressState;
export declare function updatePhase(projectRoot: string, phaseNumber: number, status: PhaseInfo['status'], blockers?: string[]): ProgressState | null;
export declare function completeTask(projectRoot: string, task: string): ProgressState | null;
export declare function recordCommit(projectRoot: string, commitHash: string): ProgressState | null;
export declare function incrementSession(projectRoot: string): ProgressState | null;
export declare function formatProgressState(progress: ProgressState): string;
export declare function getProgressSummary(projectRoot: string): string | null;
export declare function writeProgressText(projectRoot: string): void;
export interface PhaseProgress {
    phaseNumber: number;
    phaseName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying';
    startTime?: Date;
    endTime?: Date;
    retryCount: number;
    error?: string;
}
export interface IterationState {
    featureName: string;
    totalPhases: number;
    currentPhase: number;
    phases: PhaseProgress[];
    isUltrawork: boolean;
    maxRetries: number;
    startTime: Date;
    endTime?: Date;
    /** 파이프라인 모드 활성화 여부 */
    pipelineEnabled?: boolean;
}
/**
 * 새 작업 시작
 */
export declare function startIteration(featureName: string, phaseNames: string[], isUltrawork?: boolean, maxRetries?: number, pipelineEnabled?: boolean): IterationState;
/**
 * Phase 시작
 * Records an iteration with LoopBreaker; returns null if the loop limit is hit.
 */
export declare function startPhase(phaseNumber: number): PhaseProgress | null;
/**
 * Phase 완료
 * Resets the consecutive error counter in LoopBreaker on success.
 */
export declare function completePhase(phaseNumber: number): PhaseProgress | null;
/**
 * Phase 실패 (재시도 가능)
 * Records an error with LoopBreaker; forces canRetry=false when the error limit is hit.
 */
export declare function failPhase(phaseNumber: number, error: string): {
    canRetry: boolean;
    phase: PhaseProgress;
} | null;
/**
 * 전체 작업 완료
 */
export declare function completeIteration(): IterationState | null;
/**
 * 현재 상태 조회
 */
export declare function getCurrentState(): IterationState | null;
/**
 * Returns the current LoopBreaker instance for external inspection.
 */
export declare function getIterationLoopBreaker(): LoopBreaker;
/**
 * 진행 상황 포맷팅 (터미널 출력용)
 */
export declare function formatProgress(state?: IterationState): string;
/**
 * Phase 시작 배너
 */
export declare function formatPhaseStart(phaseNumber: number, phaseName: string, totalPhases: number): string;
/**
 * Phase 완료 배너
 */
export declare function formatPhaseComplete(phaseNumber: number, totalPhases: number): string;
/**
 * 전체 완료 배너
 */
export declare function formatIterationComplete(state: IterationState): string;
/**
 * Split SPEC 감지 및 파싱
 */
export declare function detectSplitSpec(specPath: string): {
    isSplit: boolean;
    masterPath?: string;
    phasePaths?: string[];
};
/**
 * SPEC에서 Phase 이름 추출
 */
export declare function extractPhaseNames(specContent: string): string[];
//# sourceMappingURL=IterationTracker.d.ts.map