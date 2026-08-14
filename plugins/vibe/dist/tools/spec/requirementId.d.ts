/**
 * Requirement ID System - 요구사항 ID 관리
 *
 * ID 형식: REQ-{feature}-{number}
 * 예: REQ-login-001, REQ-auth-002
 */
/**
 * 새 요구사항 ID 생성
 */
export declare function generateRequirementId(feature: string): string;
/**
 * 여러 요구사항 ID 일괄 생성
 */
export declare function generateRequirementIds(feature: string, count: number): string[];
/**
 * ID 유효성 검증
 */
export declare function validateRequirementId(id: string): {
    valid: boolean;
    error?: string;
};
/**
 * ID 중복 검사
 */
export declare function checkDuplicateId(id: string): boolean;
/**
 * 기존 ID 등록 (기존 SPEC 로드 시)
 */
export declare function registerExistingId(id: string): boolean;
/**
 * 여러 기존 ID 등록
 */
export declare function registerExistingIds(ids: string[]): {
    registered: number;
    skipped: number;
    errors: string[];
};
/**
 * ID에서 Feature 이름 추출
 */
export declare function extractFeatureFromId(id: string): string | null;
/**
 * ID에서 번호 추출
 */
export declare function extractNumberFromId(id: string): number | null;
/**
 * Feature별 사용된 ID 목록 조회
 */
export declare function getIdsByFeature(feature: string): string[];
/**
 * 모든 사용된 ID 조회
 */
export declare function getAllUsedIds(): string[];
/**
 * ID 카운터 리셋 (테스트용)
 */
export declare function resetCounters(): void;
/** Alias for resetCounters (테스트 호환성) */
export declare const resetRequirementCounter: typeof resetCounters;
/**
 * 현재 카운터 상태 조회
 */
export declare function getCounterStatus(): Record<string, number>;
//# sourceMappingURL=requirementId.d.ts.map