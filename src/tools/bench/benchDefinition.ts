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
export const DEFAULT_MIN_RUNS_PER_ARM = 5;

function checkArms(arms: BenchArm[] | undefined, findings: BenchFinding[]): void {
  const list = Array.isArray(arms) ? arms : [];
  if (list.length < 2) {
    findings.push({
      severity: 'P1',
      code: 'too-few-arms',
      message: '비교할 조건(arm)이 2개 미만이다 — 대조할 상대가 없으면 벤치가 아니라 단일 측정이다.',
    });
  }
  const ids = list.map((arm) => arm && arm.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    findings.push({
      severity: 'P1',
      code: 'duplicate-arm-id',
      message: 'arm id 가 중복이다 — 집계가 어느 조건의 결과인지 구분하지 못한다.',
    });
  }
  if (ids.length !== list.length) {
    findings.push({
      severity: 'P1',
      code: 'missing-arm-id',
      message: 'id 없는 arm 이 있다.',
    });
  }
}

function checkTaskSet(taskSet: string[] | undefined, findings: BenchFinding[]): void {
  if (!Array.isArray(taskSet) || taskSet.length === 0) {
    findings.push({
      severity: 'P1',
      code: 'empty-task-set',
      message: '과제 셋이 비어 있다 — 모든 arm 이 같은 일을 해야 비교가 성립한다.',
    });
    return;
  }
  if (new Set(taskSet).size !== taskSet.length) {
    findings.push({
      severity: 'P2',
      code: 'duplicate-task',
      message: '과제 id 가 중복이다 — 같은 과제가 두 번 세어진다.',
    });
  }
}

export function validateBenchDefinition(definition: BenchDefinition): BenchValidationResult {
  const findings: BenchFinding[] = [];
  if (!definition || typeof definition.name !== 'string' || definition.name.length === 0) {
    findings.push({ severity: 'P1', code: 'missing-name', message: '벤치 이름이 없다.' });
  }
  checkArms(definition && definition.arms, findings);
  checkTaskSet(definition && definition.taskSet, findings);

  const minRuns = definition && definition.minRunsPerArm;
  if (minRuns !== undefined && (!Number.isInteger(minRuns) || minRuns < 1)) {
    findings.push({
      severity: 'P1',
      code: 'invalid-min-runs',
      message: 'minRunsPerArm 은 1 이상의 정수여야 한다.',
    });
  }
  return { valid: !findings.some((f) => f.severity === 'P1'), findings };
}
