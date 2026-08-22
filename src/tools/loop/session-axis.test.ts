/**
 * 세션 축 — 한 호출에서 몇 바퀴를 도는가.
 *
 * `per-iteration` 은 한 바퀴만 돌고 끝낸다. 반복은 스케줄러가 만들고, 회전 사이
 * 맥락은 파일(원장·인박스)로만 넘어간다. 호출마다 컨텍스트가 0에서 시작하므로
 * 누적이 없는 대신 매번 ANCHOR 문서를 다시 읽는 고정 비용이 붙는다.
 *
 * **어느 쪽이 결과가 나은지는 측정된 바 없다.** 그래서 기본값(`continuous`)을
 * 바꾸지 않고 축만 연다 — 여기서 고정하는 것은 우열이 아니라 **정의의 일관성**이다.
 */
import { describe, it, expect } from 'vitest';
import { validateLoopDefinition } from './validateLoopDefinition.js';

const def = (over: Record<string, string> = {}): string => {
  const fields: Record<string, string> = {
    name: 'demo',
    trigger: 'scheduled',
    schedule: '"0 2 * * *"',
    goal: '"한 문장 목표"',
    discover: '"항목을 찾는다"',
    verify: 'ledger',
    max_iterations: '10',
    isolation: 'none',
    status: 'active',
    ...over,
  };
  const body = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${body}\npipeline:\n  - vibe.run\n---\n\n# 루프\n`;
};

describe('session 축', () => {
  it('생략하면 continuous 다 — 기존 동작이 기본값이다', () => {
    const r = validateLoopDefinition(def());
    expect(r.valid).toBe(true);
    expect(r.definition?.session).toBe('continuous');
  });

  it('per-iteration 을 받는다', () => {
    const r = validateLoopDefinition(def({ session: 'per-iteration', max_iterations: '1' }));
    expect(r.errors).toEqual([]);
    expect(r.definition?.session).toBe('per-iteration');
  });

  it('모르는 값은 거부한다', () => {
    const r = validateLoopDefinition(def({ session: 'once' }));
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toContain('session');
  });

  /**
   * 두 필드가 서로 다른 말을 하면 "한 바퀴만" 인지 "열 바퀴까지" 인지 정의가
   * 모호해진다. 필드 하나가 두 뜻을 갖는 것을 막는다.
   */
  it('per-iteration 인데 max_iterations 가 1 이 아니면 거부한다', () => {
    const r = validateLoopDefinition(def({ session: 'per-iteration', max_iterations: '10' }));
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/max_iterations 가 1/);
  });

  it('continuous 는 max_iterations 를 제한하지 않는다', () => {
    expect(validateLoopDefinition(def({ session: 'continuous', max_iterations: '10' })).valid)
      .toBe(true);
  });

  it('per-iteration + max_iterations 1 은 통과한다 — 정합한 조합', () => {
    expect(validateLoopDefinition(def({ session: 'per-iteration', max_iterations: '1' })).valid)
      .toBe(true);
  });
});
