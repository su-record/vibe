/**
 * 벤치 정의 노드 가드 — 비교할 수 없는 정의가 집계로 넘어가기 전에 잡는다.
 *
 * 비교의 전제는 "조건만 다르고 나머지는 같다" 이다. 그 전제가 깨진 정의는 집계 단계에서
 * 그럴듯한 숫자를 낸다 — 다른 일을 시킨 두 결과를 나란히 놓아도 평균은 나오기 때문이다.
 * 그래서 정의 단계에서 막는다 (`validateSpecDocument` 와 같은 노드 가드 규약).
 */
export type BenchFindingSeverity = 'P1' | 'P2';
export interface BenchFinding {
    severity: BenchFindingSeverity;
    code: string;
    message: string;
}
/** 비교할 조건 하나 — 이 축만 다르고 나머지는 같아야 한다 */
export interface BenchArm {
    id: string;
    description: string;
    /** 이 arm 이 바꾸는 설정 (예: `{ session: 'per-iteration' }`) */
    config: Record<string, unknown>;
}
export interface BenchDefinition {
    name: string;
    /** 모든 arm 이 동일하게 수행할 과제 id 목록 */
    taskSet: string[];
    arms: BenchArm[];
    /** arm 당 최소 사용 가능 실행 수 — 미달이면 판정하지 않는다 */
    minRunsPerArm?: number;
}
export interface BenchValidationResult {
    /** P1 이 하나도 없으면 통과 — P2 는 통과를 막지 않는다 */
    valid: boolean;
    findings: BenchFinding[];
}
/** arm 당 최소 실행 수 기본값 — 한 자릿수 표본에서 어떤 차이든 우연과 구분되지 않는다 */
export declare const DEFAULT_MIN_RUNS_PER_ARM = 5;
export declare function validateBenchDefinition(definition: BenchDefinition): BenchValidationResult;
//# sourceMappingURL=benchDefinition.d.ts.map