#!/usr/bin/env node
/**
 * Stop dispatcher — Claude 응답 종료 시 수렴/알림/커밋/로그 스크립트를 순차 실행.
 *
 * 실행 순서 (순차 — auto-commit 의 git cascade 충돌 방지):
 *   1. stop-convergence  — 수렴 조건 미충족 시 exit/JSON=block 으로 재시도 유도
 *                          (P1.1 — CLAUDE.md Convergence 규칙 훅 기반 강제)
 *   2. codex-review-gate — 리뷰 필요 여부 판단 (stdout → Claude 지시 주입)
 *   3. stop-notify       — 완료 알림
 *   4. auto-commit       — 변경 자동 커밋
 *   5. devlog-gen        — 개발 로그 기록
 *
 * stop-convergence 가 block 신호를 내면 나머지 단계는 건너뛴다 — 커밋/알림은
 * "응답이 진짜로 끝났을 때" 만 발생해야 한다.
 *
 * 재귀 가드: VIBE_HOOK_DEPTH 있으면 자식 세션 — skip.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dispatch } from './lib/dispatcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

// stdin 을 한 번 읽어 자식들에 동일 페이로드 전달.
let stdinData = '';
if (!process.stdin.isTTY) {
  for await (const chunk of process.stdin) stdinData += chunk;
}

/** stop-convergence.js 를 직접 실행. JSON {decision:"block"} 을 찍으면 stdout 그대로 전달. */
function runConvergence() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'stop-convergence.js');
    let collected = '';
    const proc = spawn(process.execPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      timeout: 10000,
    });
    proc.stdout.on('data', (d) => { collected += d.toString(); });
    if (stdinData) proc.stdin.end(stdinData); else proc.stdin.end();
    proc.on('close', () => resolve(collected));
    proc.on('error', () => resolve(''));
  });
}

const convergenceOutput = await runConvergence();
// 수렴이 block 을 요청했으면 JSON 을 그대로 내보내고 뒤 단계(커밋/알림) 중단.
if (convergenceOutput.includes('"decision":"block"')) {
  process.stdout.write(convergenceOutput);
  process.exit(0);
}

try {
  await dispatch([
    { name: 'codex-review-gate', script: 'codex-review-gate.js' },
    { name: 'stop-notify',       script: 'stop-notify.js'       },
    { name: 'auto-commit',       script: 'auto-commit.js'       },
    { name: 'devlog-gen',        script: 'devlog-gen.js'        },
  ]);
} catch { /* noise suppression */ }
process.exit(0);
