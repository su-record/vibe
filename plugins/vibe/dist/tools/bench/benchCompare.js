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
import { DEFAULT_MIN_RUNS_PER_ARM } from './benchDefinition.js';
function range(values) {
    if (values.length === 0)
        return null;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return { min: Math.min(...values), max: Math.max(...values), mean: sum / values.length };
}
function exclusionOf(run) {
    const cost = run.cost;
    if (!cost || cost.measured !== true)
        return 'cost-unmeasured';
    if (cost.truncated === true)
        return 'cost-truncated';
    return null;
}
/**
 * arm 하나의 집계.
 *
 * 과제 셋이 다른 실행을 **여기서 조용히 버리지 않는다** — 관측된 해시를 전부 남기고
 * 판정은 `compareArms` 가 한다. 버리면 사용자가 의도하지 않은 부분집합 위에서 비교가
 * 진행되고, 그 사실이 결과 어디에도 안 보인다.
 */
export function summarizeArm(armId, runs) {
    const mine = runs.filter((run) => run.armId === armId);
    const excluded = { 'cost-unmeasured': 0, 'cost-truncated': 0 };
    const usable = [];
    for (const run of mine) {
        const reason = exclusionOf(run);
        if (reason)
            excluded[reason] += 1;
        else
            usable.push(run);
    }
    return {
        armId,
        totalRuns: mine.length,
        usableRuns: usable.length,
        excluded,
        taskSetHashes: [...new Set(mine.map((run) => run.taskSetHash))].sort(),
        gatePassed: usable.filter((run) => run.gatesPassed).length,
        iterations: range(usable.map((run) => run.iterations)),
        toolCalls: range(usable.map((run) => Number(run.cost?.toolCalls) || 0)),
    };
}
function taskSetsDiffer(a, b) {
    if (a.taskSetHashes.length !== 1 || b.taskSetHashes.length !== 1)
        return true;
    return a.taskSetHashes[0] !== b.taskSetHashes[0];
}
function overlaps(a, b) {
    return a.min <= b.max && b.min <= a.max;
}
/**
 * 두 arm 을 하나의 지표로 비교한다.
 *
 * 판정 규칙은 **보수적이고 비모수적**이다: 두 arm 의 관측 범위(min~max)가 겹치면
 * `inconclusive`. 유의성 검정이 아니며 그런 척하지 않는다 — 표본이 한 자릿수인데
 * t-검정을 붙이면 정밀해 **보이는** 숫자가 나오고, 없는 정밀도를 만드는 것이 근거 없는
 * 배수보다 나을 것이 없다.
 */
export function compareArms(a, b, metric = 'iterations', minRunsPerArm = DEFAULT_MIN_RUNS_PER_ARM) {
    const base = { metric, arms: [a, b], delta: null };
    if (taskSetsDiffer(a, b)) {
        return {
            ...base,
            verdict: 'mixed-task-sets',
            reason: '두 arm 이 같은 과제 셋을 돌지 않았다 — 다른 일을 시킨 결과는 비교가 아니다.',
        };
    }
    if (a.usableRuns < minRunsPerArm || b.usableRuns < minRunsPerArm) {
        return {
            ...base,
            verdict: 'insufficient-runs',
            reason: `사용 가능한 실행이 arm 당 ${minRunsPerArm}회 미만이다 `
                + `(${a.armId}: ${a.usableRuns} · ${b.armId}: ${b.usableRuns}) — 어떤 차이든 우연과 구분되지 않는다.`,
        };
    }
    const left = a[metric];
    const right = b[metric];
    if (!left || !right) {
        return { ...base, verdict: 'insufficient-runs', reason: `${metric} 관측값이 없다.` };
    }
    if (overlaps(left, right)) {
        return {
            ...base,
            verdict: 'inconclusive',
            reason: `관측 범위가 겹친다 (${a.armId}: ${left.min}~${left.max} · ${b.armId}: ${right.min}~${right.max})`
                + ' — 이 표본으로는 차이를 말할 수 없다.',
        };
    }
    return {
        ...base,
        verdict: 'difference-observed',
        reason: `관측 범위가 겹치지 않는다 (${a.armId}: ${left.min}~${left.max} · ${b.armId}: ${right.min}~${right.max}).`
            + ' 차이가 관측됐다는 뜻이며, 어느 쪽이 나은지는 지표의 방향에 달렸다 — 사람이 판단한다.',
        delta: right.mean - left.mean,
    };
}
//# sourceMappingURL=benchCompare.js.map