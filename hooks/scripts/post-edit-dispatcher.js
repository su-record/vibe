#!/usr/bin/env node
/**
 * PostToolUse dispatcher — Write/Edit 이후 순차 실행.
 *
 * 기존: PostToolUse.Write|Edit 배열에 3개 스크립트가 병렬 spawn (프로세스 피크 3배)
 *       + PostToolUse.Edit 추가로 post-edit.js 1개 더
 * 현재: 단일 디스패처에서 순차 실행. config.hooks.{name}.enabled로 개별 토글.
 *
 * 실행 순서:
 *   1. auto-format — 코드 스타일 정규화
 *   2. code-check — 린트/품질 검사
 *   3. auto-test — 관련 테스트 실행
 *   4. post-edit — Edit 전용 후처리 (Write에서는 스크립트 내부에서 스킵)
 *
 * 실패 격리: 한 스크립트 실패해도 다음은 계속 진행.
 */
import { dispatch } from './lib/dispatcher.js';

try {
  await dispatch([
    { name: 'auto-format',       script: 'auto-format.js'       },
    { name: 'code-check',        script: 'code-check.js'        },
    { name: 'auto-test',         script: 'auto-test.js'         },
    { name: 'post-edit',         script: 'post-edit.js'         },
    { name: 'post-tool-failure', script: 'post-tool-failure.js' },
  ]);
} catch { /* noise suppression */ }
process.exit(0);
