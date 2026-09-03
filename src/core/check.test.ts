import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateDoneIfEdited, readResults, runChecks } from './check.js';
import { VibeError } from './errors.js';
import { openQuestions } from './inbox.js';
import { approve, draft } from './intent.js';
import { readLedger } from './ledger.js';
import { readState, transition } from './state.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-check-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const INTENT = '# 테스트 Intent\n\n## 왜\n검사\n';

function approved(scenarios: string): void {
  const result = draft(root, INTENT, scenarios);
  if (!result.ok) throw new Error(JSON.stringify(result.rejections));
  approve(root, result.token);
}

describe('check — 유일한 판정 경로', () => {
  it('승인 전에는 check 가 돌지 않는다 (종료 4)', async () => {
    draft(root, INTENT, `- { id: a, then: x, check: { type: run, cmd: "exit 0" } }`);
    await expect(runChecks(root)).rejects.toThrowError(VibeError);
  });

  it('run·file 검사를 하네스가 실행하고 Evidence 를 쓴다 — 전부 통과면 DONE', async () => {
    fs.writeFileSync(path.join(root, 'out.txt'), 'total=42\n');
    approved(`
- { id: ok, then: exit 0, check: { type: run, cmd: "exit 0" } }
- { id: out, then: out.txt 에 total 이 있다, check: { type: file, path: out.txt, pattern: "^total=\\\\d+$" } }
`);
    const report = await runChecks(root);
    expect(report.state).toBe('DONE');
    expect(report.done).toBe(true);
    expect(report.passed).toBe(2);
    const evidence = JSON.parse(fs.readFileSync(path.join(root, '.vibe', 'evidence', 'r-1.json'), 'utf-8'));
    expect(evidence.results.map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([['ok', 'pass'], ['out', 'pass']]);
    expect(readLedger(root).map((e) => e.event)).toEqual(['draft', 'approve', 'check', 'done']);
  });

  it('DONE 은 check 없이 만들어지지 않는다 — 상태 파일을 직접 써도 다음 state 에서 트리가 다르면 무효', async () => {
    approved(`- { id: ok, then: x, check: { type: run, cmd: "exit 0" } }`);
    // 모델이 결과 파일을 위조하고 DONE 을 선언했다고 치자
    transition(root, 'RUNNING');
    transition(root, 'DONE', { doneTree: 'forged', doneAt: new Date().toISOString() });
    expect(invalidateDoneIfEdited(root)).toBe(true);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('실패는 exit 와 출력 꼬리를 남기고 DONE 이 아니다', async () => {
    approved(`- { id: bad, then: x, check: { type: run, cmd: "echo boom; exit 3" } }`);
    const report = await runChecks(root);
    expect(report.state).toBe('RUNNING');
    expect(report.outcomes[0]).toMatchObject({ id: 'bad', status: 'fail', exit: 3, tail: 'boom' });
    expect(readResults(root)['bad']?.last).toBe('fail');
  });

  it('같은 실패 2회 연속이면 STUCK 이고 인박스에 질문이 남는다', async () => {
    approved(`- { id: bad, then: x, check: { type: run, cmd: "echo same; exit 1" } }`);
    await runChecks(root);
    const second = await runChecks(root);
    expect(second.stuck).toBe(true);
    expect(readState(root).state).toBe('STUCK');
    expect(openQuestions(root).some((q) => q.question.startsWith('STUCK'))).toBe(true);
    // 다른 실패면 streak 이 끊긴다
    fs.writeFileSync(path.join(root, '.vibe', 'scenarios.yaml'), `- { id: bad, then: x, check: { type: run, cmd: "echo other; exit 2" } }\n`);
    const third = await runChecks(root);
    expect(third.stuck).toBe(false);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('human 시나리오는 게이트가 아니다 — 인박스에 질문만 남기고 DONE 을 막지 않는다', async () => {
    approved(`
- { id: ok, then: x, check: { type: run, cmd: "exit 0" } }
- { id: taste, then: 문구가 자연스럽다, check: { type: human, question: "문구를 봐 주세요" } }
`);
    const report = await runChecks(root, { all: true });
    expect(report.done).toBe(true);
    expect(report.pending).toBe(1);
    expect(openQuestions(root).map((q) => q.scenario)).toEqual(['taste']);
    await runChecks(root, { all: true });
    expect(openQuestions(root)).toHaveLength(1);
  });

  it('DONE 이후 파일이 바뀌면 RUNNING 으로 돌아간다', async () => {
    approved(`- { id: ok, then: x, check: { type: run, cmd: "exit 0" } }`);
    await runChecks(root);
    expect(readState(root).state).toBe('DONE');
    expect(invalidateDoneIfEdited(root)).toBe(false);
    fs.writeFileSync(path.join(root, 'new-file.txt'), 'edit\n');
    expect(invalidateDoneIfEdited(root)).toBe(true);
    expect(readState(root).state).toBe('RUNNING');
  });

  it('기본 선택은 아직 통과하지 않은 시나리오만이다', async () => {
    approved(`
- { id: a, then: x, check: { type: run, cmd: "exit 0" } }
- { id: b, then: y, check: { type: run, cmd: "exit 1" } }
`);
    await runChecks(root);
    const second = await runChecks(root);
    expect(second.outcomes.map((o) => o.id)).toEqual(['b']);
  });
});
