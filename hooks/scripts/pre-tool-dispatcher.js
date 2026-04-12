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

// command-log은 Bash 전용
if (toolName === 'Bash') {
  steps.push({ name: 'command-log', script: 'command-log.js' });
}

await dispatch(steps);
