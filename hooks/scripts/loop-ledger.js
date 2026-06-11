#!/usr/bin/env node
/**
 * loop-ledger CLI — 루프 실행 이력 기록 및 stuck 감지.
 *
 * 사용법:
 *   node hooks/scripts/loop-ledger.js start <name>
 *   node hooks/scripts/loop-ledger.js end <name> <ok|fail|stuck> [summary]
 *   node hooks/scripts/loop-ledger.js check-stuck <name> <discoverHash>
 *
 * check-stuck: 'stuck' 또는 'ok'를 stdout에 출력하고 항상 exit 0.
 * 항상 exit 0 (fail-open).
 */

import { appendLoopEvent, isStuck } from './lib/loop-ledger.js';

const [, , subcommand, ...args] = process.argv;
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

if (subcommand === 'start') {
  const loop = args[0];
  if (!loop) {
    process.stdout.write('[loop-ledger] error: start 에 루프 이름이 필요합니다\n');
    process.exit(0);
  }
  appendLoopEvent(projectDir, { loop, event: 'start' });
  process.stdout.write(`[loop-ledger] start recorded: loop=${loop}\n`);

} else if (subcommand === 'end') {
  const [loop, result, ...summaryParts] = args;
  if (!loop || !result) {
    process.stdout.write('[loop-ledger] error: end 에 루프 이름과 결과(ok|fail|stuck)가 필요합니다\n');
    process.exit(0);
  }
  const summary = summaryParts.length > 0 ? summaryParts.join(' ') : undefined;
  appendLoopEvent(projectDir, { loop, event: 'end', result, summary });
  process.stdout.write(`[loop-ledger] end recorded: loop=${loop} result=${result}\n`);

} else if (subcommand === 'check-stuck') {
  const [loop, discoverHash] = args;
  if (!loop || !discoverHash) {
    process.stdout.write('[loop-ledger] error: check-stuck 에 루프 이름과 discoverHash가 필요합니다\n');
    process.stdout.write('ok\n');
    process.exit(0);
  }
  const stuck = isStuck(projectDir, loop, discoverHash);
  // 판정 직후 이번 발견 해시를 기록 — 다음 실행의 비교 기준이 된다
  appendLoopEvent(projectDir, { loop, event: 'discover', discoverHash });
  process.stdout.write(stuck ? 'stuck\n' : 'ok\n');

} else {
  process.stdout.write(
    '[loop-ledger] 사용법: start <name> | end <name> <ok|fail|stuck> [summary] | check-stuck <name> <hash>\n'
  );
}

process.exit(0);
