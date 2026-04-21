#!/usr/bin/env node
/**
 * Stop Convergence — Claude 응답 종료 시점에 수렴 조건을 자동 검증.
 *
 * CLAUDE.md Convergence Rule:
 *   "Loop until P1 = 0 AND no new findings — no round cap"
 *
 * 기존: 이 규칙은 LLM 의 규율에 의존. 사용자가 `verify/ralph/ultrawork` 같은
 *       매직 키워드를 쓰지 않으면 P1 이슈가 남아도 Stop 이 통과됨.
 *
 * 이 훅: Stop 시점에 검사 — 아래 조건 중 하나라도 참이면 JSON `decision=block`
 *       으로 에이전트를 다시 돌려 수렴을 강제:
 *
 *   1. `.vibe/regressions/*.md` 중 status: open 이 존재
 *   2. `.vibe/metrics/current-run.json` 의 마지막 typecheck/test/lint 결과가
 *      실패 상태로 기록되어 있음
 *   3. `.vibe/verify/last-report.json` 에 미해결 P1 항목이 있음
 *
 * 무한 루프 방지:
 *   - payload.stop_hook_active === true 이면 이미 한번 블록한 상태 → no-op.
 *     (Claude Code 가 자동 주입)
 *   - `.vibe/stop-convergence.state.json` 의 `consecutiveBlocks` 가 3 이상이면
 *     이 훅이 이미 3번 연속 재시도를 요청했는데도 안 풀린 상태 → 사용자에게
 *     제어권을 돌려주기 위해 이번엔 통과.
 *
 * 사용자 제어:
 *   - `.vibe/config.json` 의 `convergence.enforce === false` 로 무효화 가능.
 *   - `.vibe/config.json` 의 `convergence.ignore` 배열로 slug 단위 예외 지정 가능.
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, projectVibeRoot, projectVibePath, logHookDecision } from './utils.js';
import { emitStopBlock, shouldEnforceStop, readHookPayload } from './lib/hook-output.js';

const STATE_FILE = 'stop-convergence.state.json';
const MAX_CONSECUTIVE_BLOCKS = 3;

function readJSONSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return null; }
}

function loadConvergenceConfig() {
  const cfg = readJSONSafe(projectVibePath(PROJECT_DIR, 'config.json')) || {};
  const c = cfg.convergence || {};
  return {
    enforce: c.enforce !== false, // default ON
    ignore: Array.isArray(c.ignore) ? c.ignore : [],
  };
}

function readState() {
  const p = projectVibePath(PROJECT_DIR, STATE_FILE);
  return readJSONSafe(p) || { consecutiveBlocks: 0, lastBlockAt: null };
}

function writeState(state) {
  try {
    const p = projectVibePath(PROJECT_DIR, STATE_FILE);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state, null, 2));
  } catch { /* state 기록 실패는 무시 */ }
}

/** `.vibe/regressions/*.md` frontmatter 에서 status: open 찾기. */
function findOpenRegressions(ignoreSlugs) {
  const dir = path.join(projectVibeRoot(), 'regressions');
  if (!fs.existsSync(dir)) return [];
  const open = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const m = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!m) continue;
      const fm = m[1];
      const slugMatch = fm.match(/^slug:\s*([^\n]+)/m);
      const statusMatch = fm.match(/^status:\s*([^\n]+)/m);
      const slug = slugMatch?.[1]?.trim();
      const status = statusMatch?.[1]?.trim();
      if (status === 'open' && !ignoreSlugs.includes(slug)) {
        open.push({ slug: slug || f, file: f });
      }
    }
  } catch { /* 읽기 실패 무시 */ }
  return open;
}

/** `.vibe/metrics/current-run.json` 에서 실패 상태 탐지. */
function findFailedChecks() {
  const p = path.join(projectVibeRoot(), 'metrics', 'current-run.json');
  const data = readJSONSafe(p);
  if (!data || typeof data !== 'object') return [];
  const failed = [];
  for (const key of ['typecheck', 'lint', 'test', 'build']) {
    const entry = data[key];
    if (entry && (entry.status === 'fail' || entry.status === 'failed' || entry.failed === true)) {
      failed.push({ check: key, detail: entry.error || entry.message || 'failed' });
    }
  }
  return failed;
}

/** `.vibe/verify/last-report.json` 에서 미해결 P1 카운트. */
function findUnresolvedP1() {
  const p = path.join(projectVibeRoot(), 'verify', 'last-report.json');
  const data = readJSONSafe(p);
  if (!data || typeof data !== 'object') return 0;
  const p1 = data.p1 ?? data.P1 ?? data.unresolvedP1 ?? 0;
  return typeof p1 === 'number' ? p1 : 0;
}

// ─── Main ───────────────────────────────────────────────────────────

// 재귀 가드 (자식 Claude 세션에서는 skip)
if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

const config = loadConvergenceConfig();
if (!config.enforce) process.exit(0);

const payload = await readHookPayload();
if (!shouldEnforceStop(payload)) process.exit(0); // Claude Code 가 루프 감지

const state = readState();
if (state.consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
  // 3회 연속 블록해도 안 풀리면 사용자 개입 필요 — 이번엔 통과
  writeState({ consecutiveBlocks: 0, lastBlockAt: null });
  process.exit(0);
}

const openRegressions = findOpenRegressions(config.ignore);
const failedChecks = findFailedChecks();
const unresolvedP1 = findUnresolvedP1();

const issues = [];
if (openRegressions.length) {
  issues.push(
    `${openRegressions.length} open regression(s): ${openRegressions.slice(0, 3).map(r => r.slug).join(', ')}` +
    (openRegressions.length > 3 ? `, +${openRegressions.length - 3} more` : '')
  );
}
if (failedChecks.length) {
  issues.push(`failing checks: ${failedChecks.map(f => `${f.check} (${f.detail})`).join('; ')}`);
}
if (unresolvedP1 > 0) {
  issues.push(`${unresolvedP1} unresolved P1 finding(s) from last /vibe.verify`);
}

if (!issues.length) {
  // 수렴 완료 — state 리셋
  if (state.consecutiveBlocks > 0) writeState({ consecutiveBlocks: 0, lastBlockAt: null });
  process.exit(0);
}

// 블록
const reason = [
  'Convergence not reached — loop must continue until P1 = 0 and no open regressions.',
  'Remaining:',
  ...issues.map(i => `  - ${i}`),
  '',
  'Fix these issues then stop, or disable via .vibe/config.json { "convergence": { "enforce": false } }.',
].join('\n');

writeState({ consecutiveBlocks: state.consecutiveBlocks + 1, lastBlockAt: new Date().toISOString() });
logHookDecision('stop-convergence', 'Stop', 'block', issues.join(' | '));
emitStopBlock(reason);
process.exit(0);
