/**
 * InteractiveCheckpoint — Phase 전환 시 의사결정 게이트
 *
 * /vibe.run 워크플로우에서 주요 지점에 체크포인트를 삽입하여
 * 사용자가 방향을 확인/수정할 수 있도록 함
 */
export type CheckpointType = 'requirements_confirm' | 'architecture_choice' | 'implementation_scope' | 'verification_result' | 'fix_strategy';
export interface CheckpointOption {
    /** Option key (e.g., 'a', 'b', 'c') */
    key: string;
    /** Option label */
    label: string;
    /** Detailed description */
    description: string;
}
export interface Checkpoint {
    /** Checkpoint type */
    type: CheckpointType;
    /** Title displayed to user */
    title: string;
    /** Context/summary shown to user */
    summary: string;
    /** Available options */
    options: CheckpointOption[];
    /** Default option key (if user doesn't choose) */
    defaultOption: string;
    /** Metadata */
    metadata: Record<string, unknown>;
}
export interface CheckpointResult {
    /** Which checkpoint was resolved */
    type: CheckpointType;
    /** Selected option key */
    selectedOption: string;
    /** Timestamp */
    timestamp: string;
    /** Whether this was auto-resolved (at high automation levels) */
    autoResolved: boolean;
}
export interface CheckpointHistory {
    feature: string;
    results: CheckpointResult[];
}
/** Create a requirements confirmation checkpoint */
export declare function createRequirementsCheckpoint(requirements: string[], featureName: string): Checkpoint;
/** Create an architecture choice checkpoint with 3 approaches */
export declare function createArchitectureCheckpoint(options: Array<{
    approach: string;
    pros: string[];
    cons: string[];
    effort: string;
}>): Checkpoint;
/** Create an implementation scope checkpoint */
export declare function createScopeCheckpoint(files: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
}>, estimatedLines: number): Checkpoint;
/** Create a verification result checkpoint */
export declare function createVerificationCheckpoint(achievementRate: number, failedRequirements: string[], iteration: number): Checkpoint;
/** Create a fix strategy checkpoint */
export declare function createFixStrategyCheckpoint(issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    description: string;
}>): Checkpoint;
/** Format a checkpoint as readable prompt text */
export declare function formatCheckpoint(checkpoint: Checkpoint): string;
/** Resolve a checkpoint with user's choice */
export declare function resolveCheckpoint(checkpoint: Checkpoint, selectedKey: string): CheckpointResult;
/** Auto-resolve a checkpoint using the default option */
export declare function autoResolveCheckpoint(checkpoint: Checkpoint): CheckpointResult;
/** Create a new checkpoint history for a feature */
export declare function createHistory(feature: string): CheckpointHistory;
/** Append a result to history (immutable — returns new history) */
export declare function addToHistory(history: CheckpointHistory, result: CheckpointResult): CheckpointHistory;
//# sourceMappingURL=InteractiveCheckpoint.d.ts.map