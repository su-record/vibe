#!/usr/bin/env node
/**
 * verify-ledger CLI — vibe.verify 결과를 run-ledger에 기록.
 *
 * 사용법: node hooks/scripts/verify-ledger.js pass|fail <run-id> [results-json-path]
 *
 * pass 의 근거는 이 프로세스가 직접 실행한 테스트 명령의 exit code 다 (lib/verify-runner.js).
 * 모델이 넘긴 results.json 은 참고 기록으로만 evidence 에 남는다. 테스트 명령을 찾지
 * 못한 프로젝트에서만 results.json 으로 self-report 등급 통과를 허용하고, 그 등급은
 * ledger 의 verifyBasis 에 남아 stop 훅·auto-commit 이 경고한다.
 *
 * vibe.verify/SKILL.md 에서 검증 완료 시 호출.
 * stdout 출력은 에이전트가 Bash로 실행하는 컨텍스트이므로 허용 — 거부 사유도 stdout 으로
 * 돌려준다(모델이 다음 행동을 알 수 있게). 항상 exit 0.
 */

import { recordVerifyDetailed } from './lib/run-ledger.js';
import { runIndependentTests } from './lib/verify-runner.js';
import fs from 'fs';

const arg = process.argv[2];
const runId = process.argv[3];
const resultsPath = process.argv[4];
const passed = arg === 'pass';
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readResults(filePath) {
  try {
    if (!filePath) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function describeRun(independentRun) {
  if (independentRun) return ` — ${independentRun.command} exit ${independentRun.exitCode}`;
  return ' — no test command detected; reported results only';
}

async function main() {
  // fail 은 등급을 묻지 않는다 — 실패는 어느 근거로든 실패다. 독립 실행은 pass 요청에서만.
  const independentRun = passed ? await runIndependentTests(projectDir, { runId }) : null;
  const result = recordVerifyDetailed(projectDir, passed, {
    runId,
    verificationResults: readResults(resultsPath),
    independentRun,
  });
  const status = passed ? 'pass' : 'fail';
  if (result.ok) {
    process.stdout.write(
      `[verify-ledger] recorded: verifyPassed=${passed} (${status}, basis=${result.basis}${describeRun(independentRun)})\n`,
    );
  } else {
    process.stdout.write(`[verify-ledger] REJECTED: verifyPassed stays false — ${result.reason}\n`);
    if (independentRun && independentRun.outputTail) process.stdout.write(`${independentRun.outputTail}\n`);
  }
  process.exit(0);
}

await main();
