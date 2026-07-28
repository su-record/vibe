/**
 * dispatch() 순차 실행 계약 회귀 테스트
 *
 * stop-dispatcher.js 는 "auto-commit 의 git cascade 와 겹쳐 프로세스 폭주" 를 막기 위해
 * 순차 실행을 계약으로 문서화한다(stop-dispatcher.js 헤더). 그러나 dispatch() 가
 * Promise.all 로 구현돼 있어 실제로는 병렬이었다 — 이 테스트가 그 회귀를 막는다.
 *
 * 검증 대상은 내부 구현이 아니라 관측 가능한 실행 구간 겹침이다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');
const HARNESS = path.join(FIXTURES, 'seq-harness.js');

let traceDir;
let tracePath;

beforeEach(() => {
  traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-seq-'));
  tracePath = path.join(traceDir, 'trace.log');
  fs.writeFileSync(tracePath, '');
});

afterEach(() => {
  fs.rmSync(traceDir, { recursive: true, force: true });
});

function runHarness() {
  execFileSync('node', [HARNESS], {
    encoding: 'utf-8',
    input: JSON.stringify({ tool_name: 'Stop' }),
    timeout: 20000,
    env: {
      ...process.env,
      VIBE_SEQ_TRACE: tracePath,
      VIBE_SEQ_HOLD_MS: '120',
      // config.json 이 없는 디렉터리 → 모든 step enabled
      CLAUDE_PROJECT_DIR: traceDir,
    },
  });
  return fs.readFileSync(tracePath, 'utf-8').trim().split('\n').filter(Boolean);
}

describe('dispatch() 순차 실행 계약', () => {
  it('스텝 실행 구간이 겹치지 않는다 (start 직후 항상 같은 스텝의 end)', () => {
    const trace = runHarness();

    expect(trace).toHaveLength(6);
    for (let i = 0; i < trace.length; i += 2) {
      const [startName, startMark] = trace[i].split(':');
      const [endName, endMark] = trace[i + 1].split(':');
      expect(startMark).toBe('start');
      expect(endMark).toBe('end');
      // 병렬이면 여기서 다른 스텝의 start 가 끼어든다
      expect(endName).toBe(startName);
    }
  });

  it('선언된 순서(a → b → c)를 그대로 지킨다', () => {
    const trace = runHarness();

    expect(trace).toEqual([
      'a:start', 'a:end',
      'b:start', 'b:end',
      'c:start', 'c:end',
    ]);
  });
});
