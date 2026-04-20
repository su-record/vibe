#!/usr/bin/env node
/**
 * PreToolUse dispatcher — Bash/Edit/Write 공용.
 *
 * 기존: matcher별로 2~3개 스크립트가 병렬 spawn.
 *       - Bash: sentinel-guard + pre-tool-guard + command-log
 *       - Edit: sentinel-guard + pre-tool-guard
 *       - Write: sentinel-guard + pre-tool-guard
 * 현재: 단일 디스패처가 tool name을 인자로 받아 순차 실행.
 *
 * Deny 시맨틱 보존:
 *   sentinel-guard / pre-tool-guard가 exit 2(deny)를 반환하면 dispatcher도
 *   즉시 exit 2로 상위에 전파 → Claude Code가 도구 실행을 차단.
 *
 * 사용법: node pre-tool-dispatcher.js <Bash|Edit|Write>
 */
import { dispatch } from './lib/dispatcher.js';

const toolName = process.argv[2] || '';

const steps = [
  { name: 'sentinel-guard', script: 'sentinel-guard.js', args: [toolName], denyOnExit2: true },
  { name: 'pre-tool-guard', script: 'pre-tool-guard.js', args: [toolName], denyOnExit2: true },
];

// scope-guard는 Edit/Write에만 의미 있음 — 불필요한 spawn 회피
if (toolName === 'Edit' || toolName === 'Write') {
  steps.push({ name: 'scope-guard', script: 'scope-guard.js', args: [toolName], denyOnExit2: true });
}

// command-log은 Bash 전용
if (toolName === 'Bash') {
  steps.push({ name: 'command-log', script: 'command-log.js' });
}

// 하네스에 노이즈를 주지 않도록 디스패처 자체의 예외는 모두 흡수.
// exit 2 (deny 전파)는 dispatch() 내부에서 process.exit(2)로 처리되므로
// 여기까지 오면 "deny 아님" → 항상 exit 0.
try {
  await dispatch(steps);
} catch {
  // ignore — 하위 스크립트 크래시가 상위 훅 실패로 표시되지 않도록
}
process.exit(0);
