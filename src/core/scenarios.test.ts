import { describe, expect, it } from 'vitest';
import { parseScenarios } from './scenarios.js';

describe('scenario checkability', () => {
  it('rejects a scenario without a check — prose is not a contract', () => {
    const { scenarios, rejections } = parseScenarios(`
- id: s1
  then: the settlement sheet is produced
- id: s2
  then: totals match
  check: { type: run, cmd: "node checks/sum.js" }
`);
    expect(scenarios.map((s) => s.id)).toEqual(['s2']);
    expect(rejections).toEqual([{ id: 's1', reason: expect.stringContaining('missing check') }]);
  });

  it('requires the arguments of each check type', () => {
    const { rejections } = parseScenarios(`
- { id: a, then: x, check: { type: run } }
- { id: b, then: x, check: { type: file, path: out.json } }
- { id: c, then: x, check: { type: human } }
- { id: d, then: x, check: { type: eval, cases: c.jsonl, runner: "node r.js" } }
- { id: e, then: x, check: { type: magic } }
`);
    expect(rejections.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('enforces the id rule and catches duplicates', () => {
    const { rejections } = parseScenarios(`
- { id: "Bad ID", then: x, check: { type: human, question: q } }
- { id: dup, then: x, check: { type: human, question: q } }
- { id: dup, then: y, check: { type: human, question: q } }
`);
    expect(rejections.map((r) => r.reason)).toEqual([expect.stringContaining('id must'), expect.stringContaining('duplicate')]);
  });

  it('keeps given/when/irreversible on valid scenarios', () => {
    const { scenarios } = parseScenarios(`
- id: send
  given: the settlement sheet exists
  when: Monday 09:00
  then: it is sent to accounting
  irreversible: send
  check: { type: run, cmd: "npm run send -- --dry-run", expect: 0 }
`);
    expect(scenarios[0]).toMatchObject({ id: 'send', given: 'the settlement sheet exists', irreversible: 'send', check: { type: 'run', expect: 0 } });
  });
});
