#!/usr/bin/env node
/**
 * PostToolUse dispatcher — Write/Edit 이후 후처리.
 *
 * in-process 평탄화 (2026-06): 자식 node spawn 없이 import 실행.
 * 실작업(prettier/vitest 등)은 각 step이 자체 timeout을 가진 비동기 자식으로
 * 실행하므로 step 간 병렬성(Promise.all)은 spawn 시절과 동일하게 유지된다.
 *
 * 실행 step (모두 비차단, config.hooks.{name}.enabled로 개별 토글):
 *   auto-format — 코드 스타일 정규화
 *   code-check  — 린트/품질 검사 + 관찰 캡처
 *   auto-test   — 관련 테스트 실행
 *   post-edit   — console.log 감지
 *
 * 실패 격리: step별 try/catch — 한 step이 throw해도 나머지는 계속 진행.
 */
import { dispatchInProcess } from './lib/dispatcher.js';
import { run as autoFormat } from './auto-format.js';
import { run as codeCheck } from './code-check.js';
import { run as autoTest } from './auto-test.js';
import { run as postEdit } from './post-edit.js';

try {
  await dispatchInProcess([
    { name: 'auto-format', run: autoFormat },
    { name: 'code-check',  run: codeCheck  },
    { name: 'auto-test',   run: autoTest   },
    { name: 'post-edit',   run: postEdit   },
  ]);
} catch { /* noise suppression */ }
process.exit(0);
