/**
 * Loop Ledger 라이브러리 — 루프 실행 이력 추적 및 stuck 감지.
 *
 * 파일 위치: <projectDir>/.vibe/metrics/loop-history.jsonl
 * 형식: JSON Lines — 각 줄이 독립적인 루프 이벤트 JSON 객체
 *
 * 모든 함수는 fail-open (try/catch, 오류 시 무시하거나 안전한 기본값 반환).
 * isStuck: 같은 루프의 가장 최근 discover 이벤트의 discoverHash가
 *   신규 hash와 같으면 stuck으로 판정한다 (2회 연속 동일 발견).
 *   discover 이벤트는 CLI check-stuck이 판정 직후 스스로 기록한다 —
 *   기록 없는 판정은 다음 실행의 비교 기준을 잃는다.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { measureIterationCost, sumIterationCosts } from './iteration-cost.js';

/** 루프 이력 파일 경로 */
function historyPath(projectDir) {
  return path.join(projectDir, '.vibe', 'metrics', 'loop-history.jsonl');
}

/**
 * discover 산출물 텍스트를 sha256 hex 해시로 변환한다.
 * 공백/줄바꿈을 정규화해 동등한 출력이 동일 해시를 갖도록 한다.
 *
 * @param {string} text
 * @returns {string} sha256 hex
 */
export function hashDiscoverOutput(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/**
 * 루프 이벤트를 jsonl 파일에 append한다.
 *
 * @param {string} projectDir
 * @param {{ loop: string, event: 'start'|'discover'|'end'|'iteration'|'trial-approved', result?: 'ok'|'fail'|'stuck', summary?: string, discoverHash?: string, verified?: boolean, cost?: object }} opts
 * @returns {boolean} 성공 여부
 */
export function appendLoopEvent(projectDir, opts) {
  try {
    const p = historyPath(projectDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      loop: opts.loop,
      event: opts.event,
      ...(opts.result !== undefined ? { result: opts.result } : {}),
      ...(opts.summary !== undefined ? { summary: opts.summary } : {}),
      ...(opts.discoverHash !== undefined ? { discoverHash: opts.discoverHash } : {}),
      ...(opts.verified !== undefined ? { verified: opts.verified } : {}),
      ...(opts.cost !== undefined ? { cost: opts.cost } : {}),
    };
    fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 지정 루프의 특정 이벤트 목록을 최신순으로 읽는다.
 * 손상된 줄은 건너뛴다 (fail-open).
 *
 * @param {string} projectDir
 * @param {string} loop
 * @param {string} eventType
 * @returns {{ ts: string, discoverHash?: string }[]}
 */
function readEventsOfType(projectDir, loop, eventType) {
  try {
    const p = historyPath(projectDir);
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean);
    const events = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.loop === loop && obj.event === eventType) {
          events.push(obj);
        }
      } catch {
        // 손상된 줄 무시
      }
    }
    // 최신순 정렬 (ts 기준)
    return events.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  } catch {
    return [];
  }
}

/**
 * 신규 discoverHash가 stuck 조건을 충족하는지 판정한다.
 *
 * stuck 조건: 신규 hash가 non-empty이고, 해당 루프의 가장 최근
 * discover 이벤트에 동일한 discoverHash가 있을 때.
 * (직전 실행의 발견 + 이번 발견 = 2회 연속 동일이 되는 시점)
 *
 * 주의: 판정만 하고 기록하지 않으면 다음 실행이 비교할 기준이 없다 —
 * 호출자는 판정 직후 event:'discover'로 해시를 기록해야 한다 (CLI check-stuck이 수행).
 *
 * @param {string} projectDir
 * @param {string} loop
 * @param {string} discoverHash
 * @returns {boolean}
 */
export function isStuck(projectDir, loop, discoverHash) {
  try {
    if (!discoverHash) return false;
    const discoverEvents = readEventsOfType(projectDir, loop, 'discover');
    if (discoverEvents.length === 0) return false;
    const lastHash = discoverEvents[0].discoverHash;
    return Boolean(lastHash && lastHash === discoverHash);
  } catch {
    return false;
  }
}

/**
 * 회전 1회를 기록한다.
 *
 * 비용은 **기록 시점에 재서 원장에 박는다.** 나중에 파생하지 않는 이유: 툴 로그
 * (`current-run.jsonl`)는 2MB/5000줄에서 회전하므로 과거 창은 이미 사라졌을 수 있고,
 * 그러면 조용히 낮은 값이 나온다. 계측은 재지 못한 것을 0 으로 채우지 않는 것이 절반이다.
 *
 * 계측은 append 보다 **먼저** 한다 — 창의 끝이 이번 회전이므로, 이 이벤트가 이력에
 * 들어간 뒤에 재면 창이 자기 자신에서 시작한다.
 *
 * @param {string} projectDir
 * @param {string} loop
 * @param {boolean} verified - 이 회전이 검증을 통과했는가 (JUDGE 결정론 게이트 기준)
 * @returns {boolean}
 */
export function recordIteration(projectDir, loop, verified) {
  let cost;
  try {
    cost = measureIterationCost(projectDir, loop);
  } catch {
    cost = undefined; // fail-open — 계측 실패가 회전 기록을 막지 않는다
  }
  return appendLoopEvent(projectDir, {
    loop, event: 'iteration', verified: Boolean(verified), ...(cost ? { cost } : {}),
  });
}

/**
 * 현재 루프 실행의 예산 상태.
 *
 * 두 축을 **따로** 센다:
 *  - `iterations` — 모든 회전. `max_iterations` 와 비교하는 폭주 방어 축이다.
 *  - `verified`   — 검증을 통과한 회전만. 실제로 전진한 양이다.
 *
 * 둘을 하나로 뭉치면 "10회를 썼다" 는 알아도 "그중 8회가 헛돌았다" 는 모른다 —
 * 헛도는 루프와 원래 큰 작업을 구분할 수 없다. loop-contract 는 폭주 방어가
 * 모델의 양심이 아니라 코드여야 한다고 선언하는데, 정작 max_iterations 에는
 * 런타임 계수가 없어 모델이 스스로 세고 있었다 (감사 2026-08-10).
 *
 * 직전 `start` 이후만 센다 — 새 실행은 예산도 새로 시작한다.
 *
 * @param {string} projectDir
 * @param {string} loop
 * 세 번째 축(`cost`)은 **계측이지 판정이 아니다** — 예산 소진이나 stuck 을 좌우하지
 * 않는다. 재지 못하거나 창이 잘린 회전은 합계에서 빠지고 `cost.measuredIterations` 가
 * 분모를 알려준다. 분모를 모르면 합계는 거짓말이 된다.
 *
 * ⚠️ 이 수치로 "N% 절감" 같은 문구를 쓰지 않는다 — 비교 데이터가 쌓이기 전의
 * 배수·퍼센트는 constitution §3.5 가 금지하는 바로 그것이다. 쌓기만 한다.
 *
 * @param {number} [maxIterations=10]
 * @returns {{ iterations: number, verified: number, remaining: number, exhausted: boolean,
 *             cost: { measuredIterations: number, unmeasuredIterations: number,
 *                     elapsedMs: number, toolCalls: number, subagents: number } }}
 */
export function readBudget(projectDir, loop, maxIterations = 10) {
  const emptyCost = {
    measuredIterations: 0, unmeasuredIterations: 0, elapsedMs: 0, toolCalls: 0, subagents: 0,
  };
  const empty = {
    iterations: 0, verified: 0, remaining: maxIterations, exhausted: false, cost: emptyCost,
  };
  try {
    const raw = fs.readFileSync(historyPath(projectDir), 'utf-8');
    const events = raw.split('\n')
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(e => e && e.loop === loop);

    const lastStart = events.map(e => e.event).lastIndexOf('start');
    const scoped = lastStart === -1 ? events : events.slice(lastStart);

    const iters = scoped.filter(e => e.event === 'iteration');
    const iterations = iters.length;
    const verified = iters.filter(e => e.verified === true).length;
    const remaining = Math.max(0, maxIterations - iterations);
    return {
      iterations, verified, remaining, exhausted: remaining === 0, cost: sumIterationCosts(iters),
    };
  } catch {
    return empty;
  }
}

/**
 * 시운전 게이트 — 처음 거는 루프는 **두 바퀴만** 돌고 멈춘다.
 *
 * WHY: 자율 루프의 첫 실행은 정의가 맞는지 아무도 모르는 상태다. discover 가
 * 엉뚱한 것을 긁거나 verify 기준이 틀려 있으면 루프는 그걸 **성실하게 반복**한다.
 * 사람이 안 보는 동안 도는 것이 목적이므로, 틀린 채로 도는 것도 안 보인다.
 * 그래서 처음에는 몇 바퀴만 돌려 기록을 눈으로 확인한 뒤 풀어준다.
 *
 * `max_iterations` 와는 다른 축이다 — 그건 **한 실행의 폭주**를 막고, 이건
 * **정의가 검증되지 않은 루프**를 막는다. 폭주 예산은 매 `start` 마다 초기화되지만
 * 시운전은 승인 전까지 계속 걸린다.
 *
 * 승인은 이력에 남긴다(`event: 'trial-approved'`) — 설정 파일이 아니라 원장에
 * 두는 이유는 루프별로 다르고, 언제 누가 풀었는지가 감사 대상이기 때문이다.
 *
 * @param {string} projectDir
 * @param {string} loop
 * @param {number} [trialIterations=2] 시운전 회전 수
 * @returns {{ inTrial: boolean, cap: number|null, iterations: number, exhausted: boolean }}
 */
export function readTrialGate(projectDir, loop, trialIterations = 2) {
  const cap = Math.max(1, Number(trialIterations) || 2);
  try {
    const raw = fs.readFileSync(historyPath(projectDir), 'utf-8');
    const events = raw.split('\n')
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(e => e && e.loop === loop);

    if (events.some(e => e.event === 'trial-approved')) {
      return { inTrial: false, cap: null, iterations: 0, exhausted: false };
    }

    // 시운전 회전은 실행을 가로질러 누적한다 — 매 start 마다 초기화되면
    // 루프를 다시 걸기만 해도 시운전이 무한정 연장된다.
    const iterations = events.filter(e => e.event === 'iteration').length;
    return { inTrial: true, cap, iterations, exhausted: iterations >= cap };
  } catch {
    return { inTrial: true, cap, iterations: 0, exhausted: false };
  }
}

/** 시운전을 풀어 이 루프를 정상 예산으로 돌린다 — 사람이 기록을 확인한 뒤 호출한다 */
export function approveTrial(projectDir, loop) {
  return appendLoopEvent(projectDir, { loop, event: 'trial-approved' });
}
