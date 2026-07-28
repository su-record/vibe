/**
 * ANCHOR — 루프 회전 시작 시 디스크에서 상태를 재고정한다.
 *
 * loop-contract 는 ANCHOR 를 컨텍스트 오염 방어의 근거로 규정하는데, JUDGE·RECORD·stuck 과
 * 달리 실행 수단이 없어 모델 재량으로 남아 있었다 (감사 2026-07-28 L3). 재고정 대상이
 * 무엇인지 결정론적으로 답하는 것이 이 모듈의 역할이다 — 파일 내용을 해석하지는 않는다.
 */
import fs from 'fs';
import path from 'path';
import { readLedger } from './run-ledger.js';

/** 우선순위대로 첫 번째로 존재하는 경로를 고른다 */
function firstExisting(projectDir, candidates) {
  for (const rel of candidates) {
    if (fs.existsSync(path.join(projectDir, rel))) return rel;
  }
  return null;
}

/** `.vibe/.last-feature` 에 기록된 직전 feature 이름 */
function readLastFeature(projectDir) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, '.vibe', '.last-feature'), 'utf-8').trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** SPEC 경로 — 신규 레이아웃 우선, 레거시 폴백 */
function findSpec(projectDir, feature) {
  if (!feature) return null;
  return firstExisting(projectDir, [
    path.join('.vibe', 'specs', `${feature}.md`),
    path.join('.vibe', 'specs', feature, '_index.md'),
    path.join('.claude', 'vibe', 'specs', `${feature}.md`),
    path.join('.claude', 'specs', `${feature}.md`),
  ]);
}

/** 인박스에서 가장 최근 블록(다음 `## ` 직전까지) */
function readLatestInboxBlock(projectDir) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, '.vibe', 'loops', 'inbox.md'), 'utf-8');
    const start = raw.indexOf('## ');
    if (start === -1) return null;
    const next = raw.indexOf('\n## ', start + 3);
    return (next === -1 ? raw.slice(start) : raw.slice(start, next)).trim() || null;
  } catch {
    return null;
  }
}

/**
 * 재고정 번들 — loop-contract ANCHOR 절이 지정한 SPEC + run-ledger + scope.json + 직전 인박스.
 *
 * @param {string} projectDir
 * @param {string} [feature] - 생략 시 `.vibe/.last-feature`
 * @returns {{ feature: string|null, spec: string|null, scope: string|null,
 *             ledger: object|null, latestInbox: string|null, missing: string[] }}
 */
export function buildAnchor(projectDir, feature) {
  const resolved = feature || readLastFeature(projectDir);
  const spec = findSpec(projectDir, resolved);
  const scope = firstExisting(projectDir, [path.join('.vibe', 'scope.json')]);
  const ledger = readLedger(projectDir);

  const missing = [];
  if (!resolved) missing.push('feature');
  if (!spec) missing.push('spec');
  if (!ledger) missing.push('run-ledger');

  return { feature: resolved, spec, scope, ledger, latestInbox: readLatestInboxBlock(projectDir), missing };
}
