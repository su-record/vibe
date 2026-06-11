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
 * @param {{ loop: string, event: 'start'|'discover'|'end', result?: 'ok'|'fail'|'stuck', summary?: string, discoverHash?: string }} opts
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
