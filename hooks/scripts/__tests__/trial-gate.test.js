/**
 * 시운전 게이트 — 처음 거는 루프는 두 바퀴만 돌고 멈춘다.
 *
 * WHY: 자율 루프의 첫 실행은 정의가 맞는지 아무도 모르는 상태다. discover 가
 * 엉뚱한 것을 긁거나 verify 기준이 틀려 있으면 루프는 그걸 **성실하게 반복한다.**
 * 사람이 안 보는 동안 도는 것이 목적이므로, 틀린 채로 도는 것도 안 보인다.
 *
 * `max_iterations` 와 헷갈리면 안 된다 — 그건 **한 실행의 폭주**를 막고, 이건
 * **정의가 검증되지 않은 루프**를 막는다. 그래서 초기화 규칙이 반대다:
 * 폭주 예산은 매 `start` 마다 리셋되지만 시운전 회전은 실행을 가로질러 누적한다.
 * 리셋되면 루프를 다시 걸기만 해도 시운전이 무한정 연장돼 게이트가 무의미해진다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readTrialGate, approveTrial, recordIteration, appendLoopEvent,
} from '../lib/loop-ledger.js';

let dir;

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-trial-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('readTrialGate', () => {
  it('이력이 없으면 시운전 상태다 — 처음 거는 루프가 기본값이다', () => {
    expect(readTrialGate(dir, 'demo')).toMatchObject({ inTrial: true, cap: 2, exhausted: false });
  });

  it('상한에 닿으면 exhausted 다', () => {
    recordIteration(dir, 'demo', true);
    expect(readTrialGate(dir, 'demo').exhausted).toBe(false);
    recordIteration(dir, 'demo', true);
    expect(readTrialGate(dir, 'demo')).toMatchObject({ iterations: 2, exhausted: true });
  });

  it('상한을 조절할 수 있다', () => {
    recordIteration(dir, 'demo', true);
    expect(readTrialGate(dir, 'demo', 1).exhausted).toBe(true);
    expect(readTrialGate(dir, 'demo', 5).exhausted).toBe(false);
  });

  /** 이게 max_iterations 와 갈리는 지점이다 */
  it('start 로 초기화되지 않는다 — 다시 걸기만 해도 연장되면 게이트가 무의미하다', () => {
    recordIteration(dir, 'demo', true);
    recordIteration(dir, 'demo', true);
    appendLoopEvent(dir, { loop: 'demo', event: 'end', result: 'ok' });
    appendLoopEvent(dir, { loop: 'demo', event: 'start' });

    expect(readTrialGate(dir, 'demo').exhausted, '새 실행이 시운전을 리셋하면 안 된다')
      .toBe(true);
  });

  it('다른 루프의 회전은 세지 않는다', () => {
    recordIteration(dir, 'other', true);
    recordIteration(dir, 'other', true);
    expect(readTrialGate(dir, 'demo').iterations).toBe(0);
  });

  it('승인하면 시운전이 풀린다', () => {
    recordIteration(dir, 'demo', true);
    recordIteration(dir, 'demo', true);
    approveTrial(dir, 'demo');
    expect(readTrialGate(dir, 'demo')).toMatchObject({ inTrial: false, exhausted: false });
  });

  it('승인은 루프별이다 — 하나 풀었다고 전부 풀리지 않는다', () => {
    approveTrial(dir, 'demo');
    expect(readTrialGate(dir, 'other').inTrial).toBe(true);
  });

  /** 원장을 못 읽는다고 게이트를 열면 안 된다 — 판독 불가는 미승인이다 */
  it('이력을 읽지 못해도 시운전 상태를 유지한다', () => {
    expect(readTrialGate('/nonexistent/path', 'demo').inTrial).toBe(true);
  });
});
