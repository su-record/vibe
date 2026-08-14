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
export type AutomationAction = 'phase_advance' | 'architecture_choice' | 'implementation_scope' | 'fix_strategy' | 'retry' | 'destructive';
export interface TrustScore {
    score: number;
    level: AutomationLevelNumber;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    totalActions: number;
}
export declare const AUTOMATION_LEVELS: Record<AutomationLevelNumber, AutomationLevel>;
/** Magic keyword → level mapping */
export declare const KEYWORD_LEVEL_MAP: Record<string, AutomationLevelNumber>;
/** Detect automation level from user input text */
export declare function detectAutomationLevel(input: string): AutomationLevel;
/** Get level by number */
export declare function getAutomationLevel(level: AutomationLevelNumber): AutomationLevel;
/** Check if a specific action needs user confirmation at the given level */
export declare function needsConfirmation(level: AutomationLevelNumber, action: AutomationAction): boolean;
export declare function createTrustScore(): TrustScore;
export declare function recordTrustSuccess(trust: TrustScore): TrustScore;
export declare function recordTrustFailure(trust: TrustScore): TrustScore;
/** Get recommended level based on trust score */
export declare function getRecommendedLevel(trust: TrustScore): AutomationLevelNumber;
//# sourceMappingURL=AutomationLevel.d.ts.map