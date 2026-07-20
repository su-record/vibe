#!/usr/bin/env node
/**
 * verify-ledger CLI — vibe.verify 결과를 run-ledger에 기록.
 *
 * 사용법: node hooks/scripts/verify-ledger.js pass|fail
 *
 * vibe.verify/SKILL.md 에서 검증 완료 시 호출.
 * stdout 출력은 에이전트가 Bash로 실행하는 컨텍스트이므로 허용.
 * 항상 exit 0.
 */

import { recordVerify } from './lib/run-ledger.js';

const arg = process.argv[2];
const passed = arg === 'pass';
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const recorded = recordVerify(projectDir, passed);

const status = passed ? 'pass' : 'fail';
if (recorded) {
  process.stdout.write(`[verify-ledger] recorded: verifyPassed=${passed} (${status})\n`);
} else {
  process.stderr.write('[verify-ledger] WARNING: run-ledger or evidence.json write failed\n');
}
process.exit(0);
