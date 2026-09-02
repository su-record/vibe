/**
 * 회전 비용 계측 테스트 (SPEC: .vibe/specs/loop-cost-axis.md — DC-1 ~ DC-8).
 *
 * 고정하는 것은 불변식이다: 창의 경계가 원장에서 나온다는 것, 재지 못한 것이 0 이
 * 아니라는 것, 합계에 분모가 따라온다는 것. 어떤 툴 이름이 서브에이전트인지 같은
 * 선택은 SSOT(iteration-cost.js)에서 읽는다.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { measureIterationCost, sumIterationCosts, windowStart } from '../lib/iteration-cost.js';
import { appendLoopEvent, recordIteration, readBudget } from '../lib/loop-ledger.js';

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-loop-cost-'));
  fs.mkdirSync(path.join(tmpDir, '.vibe', 'metrics'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const TOOL_LOG = ['.vibe', 'metrics', 'current-run.jsonl'];

function writeToolLog(entries) {
  fs.writeFileSync(
    path.join(tmpDir, ...TOOL_LOG),
    entries.map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf-8',
  );
}

/** 원장에 직접 이벤트를 심는다 — ts 를 제어해야 창 경계를 검사할 수 있다 */
function seedHistory(events) {
  fs.writeFileSync(
    path.join(tmpDir, '.vibe', 'metrics', 'loop-history.jsonl'),
    events.map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf-8',
  );
}

describe('DC-1 — 회전 창은 원장에서 나온다', () => {
  it('직전 iteration 이 있으면 그 ts 가 창 시작이다', () => {
    seedHistory([
      { ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' },
      { ts: '2026-09-02T00:05:00.000Z', loop: 'demo', event: 'iteration', verified: false },
    ]);
    expect(windowStart(tmpDir, 'demo')).toBe('2026-09-02T00:05:00.000Z');
  });

  it('회전이 없으면 직전 start 가 창 시작이다', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    expect(windowStart(tmpDir, 'demo')).toBe('2026-09-02T00:00:00.000Z');
  });

  it('다른 루프의 이벤트는 창에 끼어들지 않는다', () => {
    seedHistory([
      { ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' },
      { ts: '2026-09-02T00:09:00.000Z', loop: 'other', event: 'iteration' },
    ]);
    expect(windowStart(tmpDir, 'demo')).toBe('2026-09-02T00:00:00.000Z');
  });

  it('이력이 없으면 null — 추측하지 않는다', () => {
    expect(windowStart(tmpDir, 'demo')).toBeNull();
  });

  it('경과 시간은 창 경계에서 계산된다', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([{ ts: '2026-09-02T00:00:30.000Z', tool: 'Bash' }]);
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:01:00.000Z');
    expect(cost.elapsedMs).toBe(60_000);
  });
});

describe('DC-2 — 툴 로그에서 집계한다', () => {
  it('창 안의 줄만 세고, 서브에이전트를 따로 센다', () => {
    seedHistory([
      { ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' },
      { ts: '2026-09-02T00:05:00.000Z', loop: 'demo', event: 'iteration' },
    ]);
    writeToolLog([
      { ts: '2026-09-02T00:01:00.000Z', tool: 'Bash' },       // 앞 회전 몫 — 세지 않는다
      { ts: '2026-09-02T00:06:00.000Z', tool: 'Edit' },
      { ts: '2026-09-02T00:07:00.000Z', tool: 'Agent' },
      { ts: '2026-09-02T00:08:00.000Z', tool: 'Task' },
      { ts: '2026-09-02T00:20:00.000Z', tool: 'Write' },      // 창 밖(미래) — 세지 않는다
    ]);
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:10:00.000Z');
    expect(cost.measured).toBe(true);
    expect(cost.toolCalls).toBe(3);
    expect(cost.subagents).toBe(2);
  });

  it('서브에이전트 툴의 옛 이름을 지우지 않는다 — 과소 매칭은 조용히 데이터를 잃는다', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([{ ts: '2026-09-02T00:01:00.000Z', tool: 'Task' }]);
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:02:00.000Z');
    expect(cost.subagents).toBe(1);
  });

  it('손상된 줄은 건너뛰고 나머지를 센다 (fail-open)', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    fs.writeFileSync(
      path.join(tmpDir, ...TOOL_LOG),
      '{ 깨진 줄\n' + JSON.stringify({ ts: '2026-09-02T00:01:00.000Z', tool: 'Bash' }) + '\n',
      'utf-8',
    );
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:02:00.000Z');
    expect(cost.toolCalls).toBe(1);
  });
});

describe('창 경계 — (직전 회전, 이번 회전] 반열림', () => {
  it('창 시작과 같은 시각의 호출은 앞 회전 몫이다 — 이중 계수를 막는다', () => {
    seedHistory([
      { ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' },
      { ts: '2026-09-02T00:05:00.000Z', loop: 'demo', event: 'iteration' },
    ]);
    writeToolLog([{ ts: '2026-09-02T00:05:00.000Z', tool: 'Bash' }]);
    expect(measureIterationCost(tmpDir, 'demo', '2026-09-02T00:10:00.000Z').toolCalls).toBe(0);
  });

  it('창 끝과 같은 시각의 호출은 이번 회전 몫이다', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([{ ts: '2026-09-02T00:10:00.000Z', tool: 'Bash' }]);
    expect(measureIterationCost(tmpDir, 'demo', '2026-09-02T00:10:00.000Z').toolCalls).toBe(1);
  });
});

describe('DC-3 — 재지 못한 것을 0 으로 적지 않는다', () => {
  it('툴 로그가 없으면 measured:false 이고 수치는 null 이다', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:01:00.000Z');
    expect(cost.measured).toBe(false);
    expect(cost.toolCalls).toBeNull();
    expect(cost.subagents).toBeNull();
    expect(cost.reason).toBe('no-tool-log');
  });

  it('툴 로그가 없어도 경과 시간은 계산한다 — 원장만으로 나오는 값이다', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:01:00.000Z');
    expect(cost.elapsedMs).toBe(60_000);
  });

  it('창 시작을 모르면 미측정이다', () => {
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:01:00.000Z');
    expect(cost.measured).toBe(false);
    expect(cost.elapsedMs).toBeNull();
  });
});

describe('DC-4 — 창이 잘리면 하한으로 표시한다', () => {
  function writeRotationMarker(keptFrom) {
    fs.writeFileSync(
      path.join(tmpDir, '.vibe', 'metrics', 'current-run-rotation.json'),
      JSON.stringify({ rotatedAt: keptFrom, keptFrom }),
      'utf-8',
    );
  }

  it('회전 마커가 창 시작 이후를 가리키면 truncated', () => {
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([{ ts: '2026-09-02T00:03:00.000Z', tool: 'Bash' }]);
    writeRotationMarker('2026-09-02T00:02:00.000Z'); // 창 시작 이후로 잘렸다
    expect(measureIterationCost(tmpDir, 'demo', '2026-09-02T00:05:00.000Z').truncated).toBe(true);
  });

  it('회전이 창 시작 이전이면 truncated 아님 — 이 창은 온전하다', () => {
    seedHistory([{ ts: '2026-09-02T00:02:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([{ ts: '2026-09-02T00:03:00.000Z', tool: 'Bash' }]);
    writeRotationMarker('2026-09-02T00:01:00.000Z');
    expect(measureIterationCost(tmpDir, 'demo', '2026-09-02T00:05:00.000Z').truncated).toBe(false);
  });

  it('마커가 없으면 회전이 없었던 것 — 추측으로 truncated 를 찍지 않는다', () => {
    // 창 시작 직후에 툴콜이 없었을 뿐인 정상 상태. 추측 판정이면 여기서 멀쩡한 회전이 버려진다
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([{ ts: '2026-09-02T00:03:00.000Z', tool: 'Bash' }]);
    const cost = measureIterationCost(tmpDir, 'demo', '2026-09-02T00:05:00.000Z');
    expect(cost.truncated).toBe(false);
    expect(cost.toolCalls).toBe(1);
  });
});

describe('DC-5 — 비용은 기록 시점에 원장에 박힌다', () => {
  it('recordIteration 이 cost 를 함께 남긴다', () => {
    appendLoopEvent(tmpDir, { loop: 'demo', event: 'start' });
    writeToolLog([{ ts: new Date().toISOString(), tool: 'Bash' }]);
    recordIteration(tmpDir, 'demo', true);

    const lines = fs.readFileSync(path.join(tmpDir, '.vibe', 'metrics', 'loop-history.jsonl'), 'utf-8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const iteration = lines.find((l) => l.event === 'iteration');
    expect(iteration.cost).toBeDefined();
    expect(iteration.cost.measured).toBe(true);
    expect(iteration.verified).toBe(true);
  });

  it('계측이 안 돼도 회전 기록 자체는 성공한다 (fail-open)', () => {
    appendLoopEvent(tmpDir, { loop: 'demo', event: 'start' });
    expect(recordIteration(tmpDir, 'demo', false)).toBe(true);
    expect(readBudget(tmpDir, 'demo').iterations).toBe(1);
  });
});

describe('DC-6 — 합계에는 분모가 따라온다', () => {
  it('미측정·절단 회전은 합계에서 빠지고 분모로 보고된다', () => {
    const total = sumIterationCosts([
      { cost: { measured: true, elapsedMs: 1000, toolCalls: 3, subagents: 1, truncated: false } },
      { cost: { measured: true, elapsedMs: 2000, toolCalls: 4, subagents: 0, truncated: false } },
      { cost: { measured: false, elapsedMs: 500, toolCalls: null, subagents: null, truncated: false } },
      { cost: { measured: true, elapsedMs: 900, toolCalls: 9, subagents: 9, truncated: true } },
      {},
    ]);
    expect(total.measuredIterations).toBe(2);
    expect(total.unmeasuredIterations).toBe(3);
    expect(total.toolCalls).toBe(7);
    expect(total.subagents).toBe(1);
    expect(total.elapsedMs).toBe(3000);
  });

  it('readBudget 이 cost 합계를 낸다', () => {
    // 창은 (직전 회전, 이번 회전] 반열림 — start 와 같은 ms 의 호출은 앞 회전 몫이다.
    // 시각을 명시해 ms 충돌로 경계가 흐려지지 않게 한다.
    seedHistory([{ ts: '2026-09-02T00:00:00.000Z', loop: 'demo', event: 'start' }]);
    writeToolLog([
      { ts: '2026-09-02T00:00:10.000Z', tool: 'Bash' },
      { ts: '2026-09-02T00:00:20.000Z', tool: 'Agent' },
    ]);
    recordIteration(tmpDir, 'demo', true);
    const budget = readBudget(tmpDir, 'demo');
    expect(budget.cost.measuredIterations).toBe(1);
    expect(budget.cost.toolCalls).toBe(2);
    expect(budget.cost.subagents).toBe(1);
  });

  it('이력이 없으면 빈 합계를 낸다', () => {
    const budget = readBudget(tmpDir, 'demo');
    expect(budget.cost).toEqual({
      measuredIterations: 0, unmeasuredIterations: 0, elapsedMs: 0, toolCalls: 0, subagents: 0,
    });
  });
});

describe('DC-7 — 기존 예산 계약이 회귀하지 않는다', () => {
  it('iterations·verified·remaining·exhausted 의미가 그대로다', () => {
    appendLoopEvent(tmpDir, { loop: 'demo', event: 'start' });
    recordIteration(tmpDir, 'demo', true);
    recordIteration(tmpDir, 'demo', false);
    const budget = readBudget(tmpDir, 'demo', 3);
    expect(budget.iterations).toBe(2);
    expect(budget.verified).toBe(1);
    expect(budget.remaining).toBe(1);
    expect(budget.exhausted).toBe(false);
  });
});

describe('DC-8 — loop-contract 예산 절 계약', () => {
  const doc = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'vibe/rules/loop-contract.md'),
    'utf-8',
  );

  it('세 번째 축이 계측으로 명시된다', () => {
    expect(doc).toMatch(/`cost` 는 계측이지 판정이 아니다/);
    expect(doc).toContain('세 축을 따로 센다');
  });

  it('재지 못한 것을 0 으로 적지 않는다는 규칙이 있다', () => {
    expect(doc).toMatch(/재지 못한 것을 0 으로 적지 않는다/);
    expect(doc).toContain('measuredIterations');
  });

  it('배수·퍼센트 금지 규율이 명시된다', () => {
    expect(doc).toMatch(/N% 절감/);
    expect(doc).toMatch(/§3\.5/);
  });
});
