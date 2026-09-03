import { describe, expect, it } from 'vitest';
import { parseScenarios } from './scenarios.js';

describe('시나리오 검사 가능성', () => {
  it('검사 유형이 없는 시나리오는 반려된다 — 산문은 Contract 가 아니다', () => {
    const { scenarios, rejections } = parseScenarios(`
- id: s1
  then: 정산표가 나온다
- id: s2
  then: 합계가 맞다
  check: { type: run, cmd: "node checks/sum.js" }
`);
    expect(scenarios.map((s) => s.id)).toEqual(['s2']);
    expect(rejections).toEqual([{ id: 's1', reason: expect.stringContaining('check 가 없다') }]);
  });

  it('유형별 필수 인자를 요구한다', () => {
    const { rejections } = parseScenarios(`
- { id: a, then: x, check: { type: run } }
- { id: b, then: x, check: { type: file, path: out.json } }
- { id: c, then: x, check: { type: human } }
- { id: d, then: x, check: { type: eval, cases: c.jsonl, runner: "node r.js" } }
- { id: e, then: x, check: { type: magic } }
`);
    expect(rejections.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('id 규칙과 중복을 잡는다', () => {
    const { rejections } = parseScenarios(`
- { id: "Bad ID", then: x, check: { type: human, question: q } }
- { id: dup, then: x, check: { type: human, question: q } }
- { id: dup, then: y, check: { type: human, question: q } }
`);
    expect(rejections.map((r) => r.reason)).toEqual([expect.stringContaining('id 는'), expect.stringContaining('중복')]);
  });

  it('올바른 시나리오는 given/when/irreversible 을 보존한다', () => {
    const { scenarios } = parseScenarios(`
- id: send
  given: 정산표가 있다
  when: 월요일 09:00
  then: 회계팀에 발송된다
  irreversible: send
  check: { type: run, cmd: "npm run send -- --dry-run", expect: 0 }
`);
    expect(scenarios[0]).toMatchObject({ id: 'send', given: '정산표가 있다', irreversible: 'send', check: { type: 'run', expect: 0 } });
  });
});
