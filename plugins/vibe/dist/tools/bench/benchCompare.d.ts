/**
 * 벤치 집계·판정 — **결론을 낼 수 없을 때 내지 않는 것**이 이 모듈의 목적이다.
 *
 * 벤치 산출물은 곧 문서의 수치가 된다. 판정을 사람의 절제에 맡기면 constitution §3.5 가
 * 금지하는 배수·퍼센트가 바로 그 자리에서 만들어진다 — "5회 돌렸더니 A 가 30% 빨랐다" 는
 * 표본이 5일 때 아무 의미가 없는데도 문장으로는 완벽하게 그럴듯하다. 그래서 판정 불가를
 * 코드가 낸다.
 *
 * 두 가지를 의도적으로 만들지 않았다:
 *  - **비율·퍼센트 필드가 없다.** 있으면 쓰이고, 쓰이면 근거 없는 배수가 문서로 간다.
 *    차이는 절대 단위 `delta` 로만 낸다
 *  - **`winner` 판정이 없다.** "차이가 관측됐다" 와 "A 를 골라라" 는 다른 주장이다.
 *    지표의 방향(적을수록 좋은가)은 도메인 지식이고 코드는 그것을 모른다
 */
/** 실행 1회의 기록 — `readBudget` 산출물에서 뽑는다 */
export interface BenchRun {
    armId: string;
    /** 이 실행이 수행한 과제 셋의 해시 — 다른 일을 시킨 결과는 비교 대상이 아니다 */
    taskSetHash: string;
    gatesPassed: boolean;
    iterations: number;
    /** `iteration-cost.js` 의 신뢰도 규약을 그대로 잇는다 */
    cost?: {
        measured?: boolean;
        truncated?: boolean;
        toolCalls?: number | null;
    };
}
/** 실행이 집계에서 빠진 사유 — 사유 없이 빠지면 분모가 조용히 줄어든다 */
export type BenchExclusion = 'cost-unmeasured' | 'cost-truncated';
export interface BenchRange {
    min: number;
    max: number;
    mean: number;
}
export interface ArmSummary {
    armId: string;
    totalRuns: number;
    usableRuns: number;
    excluded: Record<BenchExclusion, number>;
    /** 관측된 과제 셋 해시(중복 제거) — 2개 이상이면 이 arm 안에서 이미 섞였다 */
    taskSetHashes: string[];
    /** usable 실행 중 게이트를 통과한 수. **비율이 아니라 개수다** — 분모는 usableRuns */
    gatePassed: number;
    iterations: BenchRange | null;
    toolCalls: BenchRange | null;
}
export type BenchVerdict = 'insufficient-runs' | 'mixed-task-sets' | 'inconclusive' | 'difference-observed';
export type BenchMetric = 'iterations' | 'toolCalls';
export interface BenchComparison {
    metric: BenchMetric;
    verdict: BenchVerdict;
    reason: string;
    arms: [ArmSummary, ArmSummary];
    /**
     * 두 번째 arm 의 평균 − 첫 번째 arm 의 평균. **절대 단위**이고 비율이 아니다.
     * `difference-observed` 가 아니면 `null` — 판정하지 못한 차이는 수치로 내지 않는다.
     */
    delta: number | null;
}
/**
 * arm 하나의 집계.
 *
 * 과제 셋이 다른 실행을 **여기서 조용히 버리지 않는다** — 관측된 해시를 전부 남기고
 * 판정은 `compareArms` 가 한다. 버리면 사용자가 의도하지 않은 부분집합 위에서 비교가
 * 진행되고, 그 사실이 결과 어디에도 안 보인다.
 */
export declare function summarizeArm(armId: string, runs: readonly BenchRun[]): ArmSummary;
/**
 * 두 arm 을 하나의 지표로 비교한다.
 *
 * 판정 규칙은 **보수적이고 비모수적**이다: 두 arm 의 관측 범위(min~max)가 겹치면
 * `inconclusive`. 유의성 검정이 아니며 그런 척하지 않는다 — 표본이 한 자릿수인데
 * t-검정을 붙이면 정밀해 **보이는** 숫자가 나오고, 없는 정밀도를 만드는 것이 근거 없는
 * 배수보다 나을 것이 없다.
 */
export declare function compareArms(a: ArmSummary, b: ArmSummary, metric?: BenchMetric, minRunsPerArm?: number): BenchComparison;
//# sourceMappingURL=benchCompare.d.ts.map