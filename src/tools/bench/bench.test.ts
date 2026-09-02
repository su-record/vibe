import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateBenchDefinition,
  DEFAULT_MIN_RUNS_PER_ARM,
} from './benchDefinition.js';
import { summarizeArm, compareArms } from './benchCompare.js';
import { formatBenchReport } from './benchReport.js';
import type { BenchDefinition } from './benchDefinition.js';
import type { BenchRun } from './benchCompare.js';

/**
 * SPEC: .vibe/specs/loop-bench-selfcompare.md (DC-1 ~ DC-9).
 *
 * 정책 단언은 값을 박는다 — "비율 필드를 만들지 않는다"·"winner 판정이 없다" 는 임의의
 * 선택이 아니라 §3.5 를 코드로 내린 결정이고, 뒤집으려면 이 테스트를 의도적으로 지워야 한다.
 */

const ROOT = path.resolve(__dirname, '..', '..', '..');
const HASH = 'taskset-abc';

function run(armId: string, iterations: number, toolCalls: number, over: Partial<BenchRun> = {}): BenchRun {
  return {
    armId,
    taskSetHash: HASH,
    gatesPassed: true,
    iterations,
    cost: { measured: true, truncated: false, toolCalls },
    ...over,
  };
}

/** 범위가 [from, from+span] 이 되도록 n 회 실행을 만든다 */
function runs(armId: string, from: number, span: number, n: number): BenchRun[] {
  return Array.from({ length: n }, (_, i) => run(armId, from + (i % (span + 1)), 10 + i));
}

const DEFINITION: BenchDefinition = {
  name: 'session-axis',
  taskSet: ['t1', 't2'],
  arms: [
    { id: 'continuous', description: '한 세션에서 계속', config: { session: 'continuous' } },
    { id: 'per-iteration', description: '한 바퀴만', config: { session: 'per-iteration' } },
  ],
};

describe('DC-1 — 벤치 정의 가드', () => {
  it('정상 정의는 통과한다', () => {
    expect(validateBenchDefinition(DEFINITION).valid).toBe(true);
  });

  it('arm 이 2개 미만이면 P1', () => {
    const result = validateBenchDefinition({ ...DEFINITION, arms: [DEFINITION.arms[0]] });
    expect(result.valid).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('too-few-arms');
  });

  it('과제 셋이 비면 P1', () => {
    const result = validateBenchDefinition({ ...DEFINITION, taskSet: [] });
    expect(result.valid).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('empty-task-set');
  });

  it('arm id 중복은 P1 — 집계가 어느 조건인지 구분하지 못한다', () => {
    const dup = [DEFINITION.arms[0], { ...DEFINITION.arms[1], id: 'continuous' }];
    const result = validateBenchDefinition({ ...DEFINITION, arms: dup });
    expect(result.findings.map((f) => f.code)).toContain('duplicate-arm-id');
  });

  it('과제 중복은 P2 — 통과를 막지는 않는다', () => {
    const result = validateBenchDefinition({ ...DEFINITION, taskSet: ['t1', 't1'] });
    expect(result.valid).toBe(true);
    expect(result.findings.map((f) => f.code)).toContain('duplicate-task');
  });

  it('minRunsPerArm 이 정수가 아니면 P1', () => {
    expect(validateBenchDefinition({ ...DEFINITION, minRunsPerArm: 0 }).valid).toBe(false);
  });
});

describe('DC-2 — arm 집계는 분모를 잃지 않는다', () => {
  it('미측정·절단 실행을 사유별로 빼고 센다', () => {
    const sample: BenchRun[] = [
      run('a', 3, 10),
      run('a', 4, 12),
      run('a', 9, 99, { cost: { measured: false, truncated: false, toolCalls: null } }),
      run('a', 9, 99, { cost: { measured: true, truncated: true, toolCalls: 99 } }),
      run('a', 9, 99, { cost: undefined }),
      run('b', 5, 20),
    ];
    const summary = summarizeArm('a', sample);
    expect(summary.totalRuns).toBe(5);
    expect(summary.usableRuns).toBe(2);
    expect(summary.excluded['cost-unmeasured']).toBe(2); // measured:false + cost 없음
    expect(summary.excluded['cost-truncated']).toBe(1);
    expect(summary.iterations).toEqual({ min: 3, max: 4, mean: 3.5 });
  });

  it('게이트 통과는 비율이 아니라 개수다 — 분모는 usableRuns', () => {
    const summary = summarizeArm('a', [
      run('a', 3, 10),
      run('a', 4, 11, { gatesPassed: false }),
    ]);
    expect(summary.gatePassed).toBe(1);
    expect(summary.usableRuns).toBe(2);
    expect(Object.keys(summary)).not.toContain('gatePassRate');
  });

  it('관측된 과제 셋 해시를 전부 남긴다 — 조용히 버리지 않는다', () => {
    const summary = summarizeArm('a', [
      run('a', 3, 10),
      run('a', 4, 11, { taskSetHash: 'other' }),
    ]);
    expect(summary.taskSetHashes).toEqual(['other', HASH].sort());
    expect(summary.usableRuns).toBe(2); // 버리지 않았다
  });
});

describe('DC-3 · DC-4 · DC-5 — 판정 불가를 코드가 낸다', () => {
  it('실행이 최소치 미만이면 insufficient-runs', () => {
    const sample = [...runs('a', 3, 1, 3), ...runs('b', 8, 1, 3)];
    const cmp = compareArms(summarizeArm('a', sample), summarizeArm('b', sample));
    expect(cmp.verdict).toBe('insufficient-runs');
    expect(cmp.delta).toBeNull();
  });

  it('arm 간 과제 셋이 다르면 mixed-task-sets', () => {
    const sample = [
      ...runs('a', 3, 1, 6),
      ...runs('b', 8, 1, 6).map((r) => ({ ...r, taskSetHash: 'other' })),
    ];
    const cmp = compareArms(summarizeArm('a', sample), summarizeArm('b', sample));
    expect(cmp.verdict).toBe('mixed-task-sets');
  });

  it('한 arm 안에 과제 셋이 섞여도 mixed-task-sets', () => {
    const mixed = runs('a', 3, 1, 6);
    mixed[0] = { ...mixed[0], taskSetHash: 'other' };
    const sample = [...mixed, ...runs('b', 8, 1, 6)];
    expect(compareArms(summarizeArm('a', sample), summarizeArm('b', sample)).verdict)
      .toBe('mixed-task-sets');
  });

  it('관측 범위가 겹치면 inconclusive', () => {
    const sample = [...runs('a', 4, 3, 6), ...runs('b', 6, 3, 6)]; // 4~7 vs 6~9
    const cmp = compareArms(summarizeArm('a', sample), summarizeArm('b', sample));
    expect(cmp.verdict).toBe('inconclusive');
    expect(cmp.delta).toBeNull();
  });

  it('범위가 겹치지 않으면 difference-observed 와 절대 delta', () => {
    const sample = [...runs('a', 3, 1, 6), ...runs('b', 8, 1, 6)]; // 3~4 vs 8~9
    const cmp = compareArms(summarizeArm('a', sample), summarizeArm('b', sample));
    expect(cmp.verdict).toBe('difference-observed');
    expect(cmp.delta).toBeCloseTo(5, 5);
  });

  it('기본 최소 실행 수는 SSOT 에서 읽는다', () => {
    const n = DEFAULT_MIN_RUNS_PER_ARM;
    const enough = [...runs('a', 3, 1, n), ...runs('b', 8, 1, n)];
    expect(compareArms(summarizeArm('a', enough), summarizeArm('b', enough)).verdict)
      .not.toBe('insufficient-runs');
  });
});

describe('DC-6 — 비율·퍼센트·배수를 만들지 않는다 (정책 단언)', () => {
  // §3.5 를 코드로 내린 결정이다. 뒤집으려면 이 테스트를 의도적으로 지워야 한다.
  const sample = [...runs('a', 3, 1, 6), ...runs('b', 8, 1, 6)];
  const cmp = compareArms(summarizeArm('a', sample), summarizeArm('b', sample));

  /** 키를 camelCase·구분자 기준 토큰으로 쪼갠다 — `iterations` 가 'ratio' 로 잡히지 않게 */
  function tokensOf(key: string): string[] {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).map((t) => t.toLowerCase());
  }

  function allKeys(value: unknown, out: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        out.push(key);
        allKeys(child, out);
      }
    }
    return out;
  }

  it('비교 결과 어디에도 비율성 키가 없다', () => {
    const banned = new Set(['percent', 'ratio', 'speedup', 'faster', 'improvement', 'multiplier']);
    for (const key of allKeys(cmp)) {
      for (const token of tokensOf(key)) {
        expect(banned.has(token), `금지된 키: ${key}`).toBe(false);
      }
    }
  });

  it('비교 결과의 최상위 키가 정확히 6개다 — 새 키는 의도적으로 추가해야 한다', () => {
    expect(Object.keys(cmp).sort()).toEqual(['arms', 'delta', 'metric', 'reason', 'verdict'].sort());
  });

  it('winner 판정이 존재하지 않는다', () => {
    expect(Object.keys(cmp)).not.toContain('winner');
    expect(cmp.verdict).not.toBe('winner');
  });

  it('판정하지 못한 차이는 수치로 내지 않는다', () => {
    const overlap = [...runs('a', 4, 3, 6), ...runs('b', 6, 3, 6)];
    expect(compareArms(summarizeArm('a', overlap), summarizeArm('b', overlap)).delta).toBeNull();
  });
});

describe('DC-7 — 리포트', () => {
  const sample = [...runs('a', 3, 1, 6), ...runs('b', 8, 1, 6)];
  const report = formatBenchReport({
    name: 'session-axis',
    ranAt: '2026-09-02T00:00:00.000Z',
    comparison: compareArms(summarizeArm('a', sample), summarizeArm('b', sample)),
  });

  it('판정과 그 근거를 함께 적는다', () => {
    expect(report).toContain('차이 관측됨');
    expect(report).toContain('관측 범위가 겹치지 않는다');
  });

  it('arm 별 분모를 노출한다', () => {
    expect(report).toMatch(/실행: 6\/6 사용 가능/);
    expect(report).toMatch(/게이트 통과: 6\/6/);
  });

  it('퍼센트 기호를 쓰지 않는다', () => {
    expect(report).not.toContain('%');
  });

  it('어느 쪽이 낫다고 말하지 않는다', () => {
    expect(report).not.toMatch(/더 낫|우세|승자|추천/);
    expect(report).toContain('지표의 방향은 사람이 안다');
  });

  it('판정 불가도 그대로 적는다', () => {
    const few = [...runs('a', 3, 1, 2), ...runs('b', 8, 1, 2)];
    const text = formatBenchReport({
      name: 'session-axis',
      ranAt: '2026-09-02T00:00:00.000Z',
      comparison: compareArms(summarizeArm('a', few), summarizeArm('b', few)),
    });
    expect(text).toContain('판정 불가 — 표본 부족');
  });
});

describe('DC-8 · DC-9 — 스킬·문서 계약', () => {
  const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

  it('vibe.loop 에 bench 서브커맨드와 판정 어휘 4종이 있다', () => {
    const doc = read('skills/vibe.loop/SKILL.md');
    expect(doc).toMatch(/\/vibe\.loop bench/);
    expect(doc).toMatch(/##\s*bench —/);
    for (const verdict of ['insufficient-runs', 'mixed-task-sets', 'inconclusive', 'difference-observed']) {
      expect(doc).toContain(verdict);
    }
  });

  it('vibe.loop 이 비차단·비율금지를 명시한다', () => {
    const doc = read('skills/vibe.loop/SKILL.md');
    expect(doc).toMatch(/아무것도 차단하지 않고/);
    expect(doc).toMatch(/비율·퍼센트·배수를 만들지 않는다/);
    expect(doc).toMatch(/유의성 검정이 아니다/);
  });

  it('vibe.test 줄이 없는 서브커맨드를 주장하지 않는다', () => {
    for (const file of ['CLAUDE.md', 'AGENTS.md']) {
      const line = read(file).split('\n').find((l) => l.includes('vibe.test` —')) ?? '';
      expect(line, file).not.toMatch(/`parity`|`compare`/);
      expect(line, file).toContain('no subcommands');
    }
  });
});
