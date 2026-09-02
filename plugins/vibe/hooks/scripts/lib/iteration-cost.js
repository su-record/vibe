/**
 * 회전 비용 계측 — "그 전진이 얼마짜리였나" 를 코드가 센다.
 *
 * 원장은 `iterations`(폭주 방어)와 `verified`(전진량) 두 축만 세고 있었다. 둘로는
 * "10회를 썼고 2회 전진했다" 까지만 알 수 있고, 그 2회가 싼 전진이었는지 비싼
 * 전진이었는지는 모른다. vibe 가 효율에 대해 아무 주장도 할 수 없는 이유가 그것이다
 * (constitution §3.5 — 측정하지 않은 수치는 쓰지 않는다).
 *
 * **수치의 출처는 코드여야 한다.** 모델이 "도구를 12번 썼다" 고 보고하는 형태면 그건
 * vibe 가 완료 판정에서 배제하는 바로 그 자기보고이고, 그 위에 쌓인 데이터로는
 * 아무것도 주장할 수 없다. 그래서 인자로 받지 않고 이미 코드가 세고 있는 것을 읽는다 —
 * `step-counter.js`(PostToolUse)가 액션 툴콜을 `current-run.jsonl` 에 스로틀 없이 append 한다.
 *
 * 두 가지를 0 과 구분해서 남긴다. 이게 이 모듈의 존재 이유의 절반이다:
 *  - `measured: false` — 훅 미설치·첫 실행이라 **재지 못했다**. 0 이 아니다
 *  - `truncated: true` — 로그가 회전해 창의 앞부분이 사라졌다. 그 값은 **하한**이다
 * 재지 못한 것을 0 으로 채우면 훅 미설치 환경에서 "회전당 도구 0회" 라는 거짓 데이터가
 * 쌓이고, 훅은 프로젝트 로컬이라 미설치가 흔하다.
 */

import fs from 'fs';
import path from 'path';

/** 서브에이전트 스폰 툴 — 하네스가 이름을 바꾼다. 옛 이름을 지우지 않는다 (step-counter 와 같은 규칙) */
const SUBAGENT_TOOLS = new Set(['Agent', 'Task']);

function toolLogPath(projectDir) {
  return path.join(projectDir, '.vibe', 'metrics', 'current-run.jsonl');
}

function historyPath(projectDir) {
  return path.join(projectDir, '.vibe', 'metrics', 'loop-history.jsonl');
}

/** 회전 마커 — `step-counter.js` 가 jsonl 앞부분을 잘라낼 때 남긴다 */
function rotationMarkerPath(projectDir) {
  return path.join(projectDir, '.vibe', 'metrics', 'current-run-rotation.json');
}

/**
 * 창의 앞부분이 회전으로 사라졌는가.
 *
 * **추측하지 않고 마커를 읽는다.** "로그의 첫 줄이 창 시작보다 뒤" 라는 추측은 회전이
 * 없어도 항상 참이다 — 창 시작 직후에 툴콜이 없었을 뿐일 수 있다. 그 추측으로 두면
 * 멀쩡한 회전이 전부 `truncated` 로 찍혀 합계에서 조용히 빠진다. 재지 못한 것을 0 으로
 * 적지 않으려다 잰 것까지 버리는 셈이다.
 *
 * @param {string} projectDir
 * @param {string} startTs 창 시작 ISO-8601
 * @returns {boolean}
 */
function windowTruncated(projectDir, startTs) {
  try {
    const marker = JSON.parse(fs.readFileSync(rotationMarkerPath(projectDir), 'utf-8'));
    return Boolean(marker && marker.keptFrom && marker.keptFrom > startTs);
  } catch {
    return false; // 마커 없음 = 회전 없음
  }
}

function readJsonLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* 손상된 줄 무시 */ }
  }
  return out;
}

/**
 * 회전 창의 시작 시각 — 직전 `iteration`, 없으면 직전 `start`.
 *
 * 별도 신호를 만들지 않는 이유: 원장이 이미 두 시각을 갖고 있다. 새 신호를 만들면
 * 그것이 기록되지 않는 경로가 생기고, 그 경로에서 계측이 조용히 죽는다.
 *
 * @param {string} projectDir
 * @param {string} loop
 * @returns {string|null} ISO-8601, 판단 불가면 null
 */
export function windowStart(projectDir, loop) {
  try {
    const events = readJsonLines(historyPath(projectDir)).filter((e) => e && e.loop === loop);
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].event === 'iteration' || events[i].event === 'start') {
        return events[i].ts || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 창은 `(startTs, endTs]` **반열림**이다.
 *
 * 경계에 정확히 걸친 호출을 앞 회전 몫으로 두어야 이중 계수가 나지 않는다 — 직전
 * 회전의 창은 그 시각을 끝으로 포함해 이미 세었다. 같은 밀리초 충돌은 실제로 일어난다.
 */
function countInWindow(entries, startTs, endTs) {
  let toolCalls = 0;
  let subagents = 0;
  for (const entry of entries) {
    const ts = entry && entry.ts;
    if (!ts || !entry.tool || ts <= startTs || ts > endTs) continue;
    toolCalls += 1;
    if (SUBAGENT_TOOLS.has(entry.tool)) subagents += 1;
  }
  return { toolCalls, subagents };
}

/** 재지 못한 회전 — 0 이 아니라 null 로 남긴다 */
function unmeasured(elapsedMs, reason) {
  return { measured: false, reason, elapsedMs, toolCalls: null, subagents: null, truncated: false };
}

/**
 * 이번 회전의 비용을 잰다.
 *
 * `elapsedMs` 는 툴 로그와 무관하게 원장 `ts` 만으로 나오므로 로그가 없어도 계산한다.
 *
 * @param {string} projectDir
 * @param {string} loop
 * @param {string} [endTs] 회전 종료 시각 ISO-8601 (기본: 지금)
 * @returns {{ measured: boolean, reason?: string, elapsedMs: number|null,
 *            toolCalls: number|null, subagents: number|null, truncated: boolean }}
 */
export function measureIterationCost(projectDir, loop, endTs) {
  const end = endTs || new Date().toISOString();
  let elapsedMs = null;
  try {
    const start = windowStart(projectDir, loop);
    if (start) elapsedMs = Math.max(0, Date.parse(end) - Date.parse(start));

    if (!start) return unmeasured(elapsedMs, 'no-window-start');
    const logPath = toolLogPath(projectDir);
    if (!fs.existsSync(logPath)) return unmeasured(elapsedMs, 'no-tool-log');

    const entries = readJsonLines(logPath);
    if (entries.length === 0) return unmeasured(elapsedMs, 'empty-tool-log');

    // 로그가 회전해 창의 앞부분이 사라졌으면 이 회전의 수치는 하한이다
    const truncated = windowTruncated(projectDir, start);
    const { toolCalls, subagents } = countInWindow(entries, start, end);
    return { measured: true, elapsedMs, toolCalls, subagents, truncated };
  } catch {
    return unmeasured(elapsedMs, 'measure-failed');
  }
}

/**
 * 회전별 비용을 합산한다.
 *
 * 미측정·절단 회전은 **합계에서 뺀다.** 대신 `measuredIterations` 로 분모를 함께 낸다 —
 * 분모를 모르면 합계는 거짓말이 된다 ("5회전에 도구 20회" 인지 "그중 2회전만 잰 20회" 인지).
 *
 * @param {Array<{cost?: object}>} iterationEvents
 * @returns {{ measuredIterations: number, unmeasuredIterations: number,
 *            elapsedMs: number, toolCalls: number, subagents: number }}
 */
export function sumIterationCosts(iterationEvents) {
  const total = {
    measuredIterations: 0, unmeasuredIterations: 0, elapsedMs: 0, toolCalls: 0, subagents: 0,
  };
  for (const event of iterationEvents) {
    const cost = event && event.cost;
    if (!cost || cost.measured !== true || cost.truncated === true) {
      total.unmeasuredIterations += 1;
      continue;
    }
    total.measuredIterations += 1;
    total.elapsedMs += Number(cost.elapsedMs) || 0;
    total.toolCalls += Number(cost.toolCalls) || 0;
    total.subagents += Number(cost.subagents) || 0;
  }
  return total;
}
