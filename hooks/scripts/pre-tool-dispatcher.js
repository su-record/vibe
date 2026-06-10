#!/usr/bin/env node
/**
 * PreToolUse dispatcher — Bash/Edit/Write 공용.
 *
 * in-process 평탄화 (2026-06): 가드를 자식 node로 spawn하지 않고 import해서
 * 같은 프로세스에서 실행한다. 자식 VM 기동(~20ms × N)과 stdin 재읽기 제거.
 * daemon/IPC는 금지 (CLAUDE.md Gotchas) — 디스패처 프로세스 자체는 유지.
 *
 * Deny 시맨틱 보존:
 *   sentinel-guard / pre-tool-guard / scope-guard의 run(ctx)이 2를 반환하면
 *   dispatchInProcess가 process.exit(2)로 상위에 전파 → Claude Code가 도구 실행 차단.
 *
 * 사용법: node pre-tool-dispatcher.js <Bash|Edit|Write>
 */
import { dispatchInProcess } from './lib/dispatcher.js';
import { run as sentinelGuard } from './sentinel-guard.js';
import { run as preToolGuard } from './pre-tool-guard.js';
import { run as scopeGuard } from './scope-guard.js';
import { run as commandLog } from './command-log.js';

const toolName = process.argv[2] || '';

const steps = [
  { name: 'sentinel-guard', run: sentinelGuard, denyOnExit2: true },
  { name: 'pre-tool-guard', run: preToolGuard, denyOnExit2: true },
];

// scope-guard는 Edit/Write에만 의미 있음
if (toolName === 'Edit' || toolName === 'Write') {
  steps.push({ name: 'scope-guard', run: scopeGuard, denyOnExit2: true });
}

// command-log은 Bash 전용
if (toolName === 'Bash') {
  steps.push({ name: 'command-log', run: commandLog });
}

// 하네스에 노이즈를 주지 않도록 디스패처 자체의 예외는 모두 흡수.
// exit 2 (deny 전파)는 dispatchInProcess 내부에서 process.exit(2)로 처리되므로
// 여기까지 오면 "deny 아님" → 항상 exit 0.
try {
  await dispatchInProcess(steps, { argvToolName: toolName });
} catch {
  // ignore — step 크래시가 상위 훅 실패로 표시되지 않도록
}
process.exit(0);
