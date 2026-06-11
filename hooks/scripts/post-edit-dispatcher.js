#!/usr/bin/env node
/**
 * PostToolUse dispatcher — Write/Edit 이후 후처리.
 *
 * in-process 평탄화 (2026-06): 자식 node spawn 없이 import 실행.
 * 실작업(prettier/vitest 등)은 각 step이 자체 timeout을 가진 비동기 자식으로
 * 실행하므로 step 간 병렬성(Promise.all)은 spawn 시절과 동일하게 유지된다.
 *
 * 실행 step (모두 비차단, config.hooks.{name}.enabled로 개별 토글):
 *   auto-format — 코드 스타일 정규화 (변경 시 finding 반환)
 *   code-check  — 린트/품질 검사 + P1 이슈 verifyRequired 기록
 *   auto-test   — 관련 테스트 실행 (debounce 지원)
 *   post-edit   — console.log 감지
 *
 * 출력 계약 (Claude Code PostToolUse):
 *   findings 있음 → stdout에 JSON hookSpecificOutput 1개 출력, exit 0
 *   findings 없음 → stdout 없음, exit 0
 *   절대 exit 2 없음 — 차단은 downstream 게이트에서 (SPEC 설계 원칙)
 *
 * Codex 경로: codex-hook-adapter.js가 이 스크립트를 spawn하고
 *   combinedOutput(stdout+stderr)을 writeAdditionalContext로 래핑함.
 *   → stdout이 JSON hookSpecificOutput이면 어댑터가 이중 래핑함.
 *   → 어댑터에서 JSON hookSpecificOutput 형식 감지 후 bypass 처리.
 *
 * 실패 격리: step별 try/catch — 한 step이 throw해도 나머지는 계속 진행.
 */
import { readStdinSync, buildCtx } from './lib/hook-context.js';
import { readProjectConfig } from './utils.js';
import fs from 'fs';
import path from 'path';

// ─── step 임포트 ─────────────────────────────────────────────────────
import { run as autoFormat } from './auto-format.js';
import { run as codeCheck } from './code-check.js';
import { run as autoTest } from './auto-test.js';
import { run as postEdit } from './post-edit.js';

// ─── 설정 로딩 ────────────────────────────────────────────────────────
function loadHookConfig() {
  try {
    return readProjectConfig()?.hooks || {};
  } catch {
    return {};
  }
}

function isEnabled(hookConfig, name) {
  const entry = hookConfig[name];
  if (entry && typeof entry === 'object' && entry.enabled === false) return false;
  return true;
}

// ─── 메인 ─────────────────────────────────────────────────────────────
const { raw, parsed } = readStdinSync();
const ctx = buildCtx({ rawInput: raw, payload: parsed });
const hookConfig = loadHookConfig();

const steps = [
  { name: 'auto-format', run: autoFormat },
  { name: 'code-check',  run: codeCheck  },
  { name: 'auto-test',   run: autoTest   },
  { name: 'post-edit',   run: postEdit   },
];

const enabledSteps = steps.filter(s => isEnabled(hookConfig, s.name));

// 모든 step을 병렬 실행해 findings 수집
const results = await Promise.all(
  enabledSteps.map(async (step) => {
    try {
      const result = await step.run(ctx);
      // findings 배열을 반환하는 새 구조 지원 + 구형 숫자 반환 폴백
      if (result && typeof result === 'object' && Array.isArray(result.findings)) {
        return result.findings;
      }
      return [];
    } catch {
      // 크래시 격리 — 해당 step만 건너뜀
      return [];
    }
  })
);

const allFindings = results.flat().filter(f => typeof f === 'string' && f.trim().length > 0);

// findings가 있을 때만 stdout 출력
// Claude Code: JSON hookSpecificOutput → 모델이 additionalContext로 인식
// findings 없음: 조용히 종료
if (allFindings.length > 0) {
  const summary = allFindings.join('\n');
  const output = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: summary,
    },
  });
  process.stdout.write(output + '\n');
}

process.exit(0);
