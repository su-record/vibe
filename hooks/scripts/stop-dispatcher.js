#!/usr/bin/env node
/**
 * Stop dispatcher — Claude 응답 종료 시 4개 스크립트 순차 실행.
 *
 * 기존: Stop 배열에 4개 병렬 spawn (codex-review-gate + stop-notify + auto-commit + devlog-gen)
 *       → auto-commit의 git cascade와 겹쳐 프로세스 폭주 유발 가능.
 * 현재: 단일 디스패처에서 순차 실행.
 *
 * 실행 순서:
 *   0. verify-skip 경고/차단 (in-process)
 *   1. codex-review-gate — 리뷰 필요 여부 판단 (stdout → Claude 지시 주입)
 *   2. stop-notify       — 완료 알림
 *   3. auto-commit       — 변경 자동 커밋 (git hook cascade 주의)
 *   4. devlog-gen        — 개발 로그 기록
 *
 * 재귀 가드 상속: callClaudeCli가 VIBE_HOOK_DEPTH=1 env를 자식에 주입했다면
 * 이 Stop dispatcher도 건너뛴다 (자식 세션에서 auto-commit 등이 돌 이유 없음).
 */
import { dispatch } from './lib/dispatcher.js';
import { readLedger, markStopWarned, markBasisWarned, VERIFY_BASIS } from './lib/run-ledger.js';
import { PROJECT_DIR, readProjectConfig } from './utils.js';

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

// verify-skip 게이트 — runStarted가 있고 verifyPassed가 false이면 경고 또는 차단.
// stopWarned가 이미 true이면 루프 방지를 위해 스킵.
try {
  const ledger = readLedger(PROJECT_DIR);
  if (ledger && ledger.runStarted && !ledger.verifyPassed && !ledger.stopWarned) {
    const config = readProjectConfig();
    const gateMode = config?.verifyGate?.mode;

    if (gateMode === 'block') {
      // 1회에 한해 Stop 차단 — 루프 방지 플래그 먼저 세팅
      markStopWarned(PROJECT_DIR);
      const reason = '/vibe.verify not run after /vibe.run — stop blocked (verifyGate.mode=block)';
      process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
      process.exit(0);
    } else {
      // 기본: warn 모드 — stderr에 경고, 루프 방지 플래그 세팅
      markStopWarned(PROJECT_DIR);
      const feature = ledger.runFeature ? ` (feature: ${ledger.runFeature})` : '';
      process.stderr.write(`[vibe] WARNING: /vibe.run${feature} completed but /vibe.verify was not run.\n`);
    }
  }
} catch { /* verify-skip 게이트 실패는 이후 실행을 막지 않음 */ }

// 근거 등급 경고 — verifyPassed 가 self-report 등급(테스트 명령 미감지)이면 1회 알린다.
// 차단이 아니다: 명령이 없는 프로젝트를 막지 않는다는 결정 (SPEC verify-gate-independence).
try {
  const ledger = readLedger(PROJECT_DIR);
  if (ledger && ledger.verifyPassed && ledger.verifyBasis === VERIFY_BASIS.selfReport && !ledger.basisWarned) {
    markBasisWarned(PROJECT_DIR);
    process.stderr.write(
      '[vibe] WARNING: verifyPassed rests on self-report basis — no test command was detected, '
      + 'so no independent run backs it. Set verifyGate.command in .vibe/config.json to upgrade.\n',
    );
  }
} catch { /* 등급 경고 실패는 이후 실행을 막지 않음 */ }

try {
  await dispatch([
    { name: 'codex-review-gate', script: 'codex-review-gate.js' },
    { name: 'stop-notify',       script: 'stop-notify.js'       },
    { name: 'auto-commit',       script: 'auto-commit.js'       },
    { name: 'devlog-gen',        script: 'devlog-gen.js'        },
  ]);
} catch { /* noise suppression */ }
process.exit(0);
