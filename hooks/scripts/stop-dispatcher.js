#!/usr/bin/env node
/**
 * Stop dispatcher — Claude 응답 종료 시 4개 스크립트 순차 실행.
 *
 * 기존: Stop 배열에 4개 병렬 spawn (codex-review-gate + stop-notify + auto-commit + devlog-gen)
 *       → auto-commit의 git cascade와 겹쳐 프로세스 폭주 유발 가능.
 * 현재: 단일 디스패처에서 순차 실행.
 *
 * 실행 순서:
 *   1. codex-review-gate — 리뷰 필요 여부 판단 (stdout → Claude 지시 주입)
 *   2. stop-notify       — 완료 알림
 *   3. auto-commit       — 변경 자동 커밋 (git hook cascade 주의)
 *   4. devlog-gen        — 개발 로그 기록
 *
 * 재귀 가드 상속: callClaudeCli가 VIBE_HOOK_DEPTH=1 env를 자식에 주입했다면
 * 이 Stop dispatcher도 건너뛴다 (자식 세션에서 auto-commit 등이 돌 이유 없음).
 */
import { dispatch } from './lib/dispatcher.js';

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

try {
  await dispatch([
    { name: 'codex-review-gate', script: 'codex-review-gate.js' },
    { name: 'stop-notify',       script: 'stop-notify.js'       },
    { name: 'auto-commit',       script: 'auto-commit.js'       },
    { name: 'devlog-gen',        script: 'devlog-gen.js'        },
  ]);
} catch { /* noise suppression */ }
process.exit(0);
