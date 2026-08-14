#!/usr/bin/env node
/**
 * Codex notify adapter — Codex `~/.codex/config.toml` 의 `notify` 프로그램으로 호출됨.
 *
 * Codex 는 Claude Code 의 Stop hook 등가물이 없다. 대신 lifecycle 이벤트마다
 * `notify` 에 등록된 프로그램을 마지막 인자로 JSON payload 를 붙여 실행한다.
 * 이 어댑터는 `agent-turn-complete` 이벤트를 CC 의 Stop 에 매핑해, stdin 이 필요
 * 없는 결정적 후처리(auto-commit, devlog-gen)만 재사용한다.
 *
 * - codex-review-gate: stdout→Claude 주입 방식이라 Codex 에서 의미 없음 → 제외
 * - stop-notify: Codex 가 자체 완료 표시를 하므로 중복 알림 방지 위해 제외
 *
 * 재귀 가드: VIBE_HOOK_DEPTH 가 있으면(자식 세션) 건너뛴다.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

// Codex 는 payload JSON 을 마지막 인자로 전달한다.
function parsePayload() {
  const raw = process.argv[process.argv.length - 1];
  if (!raw || raw === path.basename(process.argv[1] ?? '')) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const payload = parsePayload();
const type = payload?.type ?? payload?.['type'];

// turn 완료 이벤트만 처리 (CC 의 Stop 등가)
if (type !== 'agent-turn-complete') process.exit(0);

const TURN_COMPLETE_SCRIPTS = ['auto-commit.js', 'devlog-gen.js'];

for (const script of TURN_COMPLETE_SCRIPTS) {
  spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, VIBE_HOOK_DEPTH: '1' },
  });
}

process.exit(0);
