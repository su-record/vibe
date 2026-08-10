/**
 * 회전 계수 · 예산 테스트.
 *
 * loop-contract 는 "폭주 방어가 모델의 양심이 아니라 결정론적 가드(코드)" 라고
 * 선언하는데, 정작 그 폭주 방어인 `max_iterations` 에는 런타임 계수가 없었다 —
 * 모델이 스스로 회전을 세고 있었다 (감사 2026-08-10). stuck 만 결정론이었다.
 *
 * 두 축을 따로 세는 이유: 하나로 뭉치면 "10회를 썼다" 는 알아도 "그중 8회가
 * 헛돌았다" 는 모른다. 헛도는 루프와 원래 큰 작업을 구분할 수 없다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { appendLoopEvent, recordIteration, readBudget } from '../lib/loop-ledger.js';

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-budget-'));
});

afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

const iterate = (loop, ...outcomes) => {
  for (const verified of outcomes) recordIteration(dir, loop, verified);
};

describe('readBudget — 두 축을 따로 센다', () => {
  it('이력이 없으면 전액 남는다', () => {
    expect(readBudget(dir, 'x', 10)).toEqual({
      iterations: 0, verified: 0, remaining: 10, exhausted: false,
    });
  });

  it('회전 수와 검증 통과 수를 구분한다', () => {
    iterate('demo', false, false, true);

    const b = readBudget(dir, 'demo', 10);
    expect(b.iterations).toBe(3);
    expect(b.verified).toBe(1);   // 헛돈 2회를 구분할 수 있다
    expect(b.remaining).toBe(7);
  });

  it('상한에 도달하면 exhausted', () => {
    iterate('demo', false, false, false);
    expect(readBudget(dir, 'demo', 3).exhausted).toBe(true);
    expect(readBudget(dir, 'demo', 3).remaining).toBe(0);
  });

  it('상한을 넘겨도 remaining 이 음수가 되지 않는다', () => {
    iterate('demo', false, false, false, false, false);
    expect(readBudget(dir, 'demo', 3).remaining).toBe(0);
  });

  it('전부 검증 통과면 두 축이 같다', () => {
    iterate('demo', true, true);
    const b = readBudget(dir, 'demo', 10);
    expect(b.iterations).toBe(2);
    expect(b.verified).toBe(2);
  });
});

describe('실행 경계 — 새 start 는 예산을 새로 시작한다', () => {
  it('직전 start 이후만 센다', () => {
    appendLoopEvent(dir, { loop: 'demo', event: 'start' });
    iterate('demo', false, false);
    appendLoopEvent(dir, { loop: 'demo', event: 'end', result: 'stuck' });

    appendLoopEvent(dir, { loop: 'demo', event: 'start' });  // 두 번째 실행
    iterate('demo', true);

    const b = readBudget(dir, 'demo', 10);
    expect(b.iterations).toBe(1);   // 이전 실행의 2회는 세지 않는다
    expect(b.verified).toBe(1);
  });

  it('start 가 없으면 전체를 센다 (폴백)', () => {
    iterate('demo', false, true);
    expect(readBudget(dir, 'demo', 10).iterations).toBe(2);
  });
});

describe('격리와 견고성', () => {
  it('다른 루프의 회전은 섞이지 않는다', () => {
    iterate('a', false, false);
    iterate('b', true);

    expect(readBudget(dir, 'a', 10).iterations).toBe(2);
    expect(readBudget(dir, 'b', 10).iterations).toBe(1);
  });

  it('discover/end 이벤트는 회전으로 세지 않는다', () => {
    appendLoopEvent(dir, { loop: 'demo', event: 'discover', discoverHash: 'h' });
    appendLoopEvent(dir, { loop: 'demo', event: 'end', result: 'ok' });
    iterate('demo', true);

    expect(readBudget(dir, 'demo', 10).iterations).toBe(1);
  });

  it('손상된 줄은 건너뛴다 (fail-open)', () => {
    iterate('demo', true);
    const p = path.join(dir, '.vibe', 'metrics', 'loop-history.jsonl');
    fs.appendFileSync(p, '{ broken json\n', 'utf-8');
    iterate('demo', true);

    expect(readBudget(dir, 'demo', 10).iterations).toBe(2);
  });

  it('이력 파일이 없어도 던지지 않는다', () => {
    expect(() => readBudget(dir, 'none', 10)).not.toThrow();
  });
});
