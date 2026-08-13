#!/usr/bin/env node
/**
 * Codex native hook adapter.
 *
 * Maps Codex hook events to the existing vibe hook scripts while preserving
 * Codex JSON decisions for permission-deny cases.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractPrompt,
  extractToolInput,
  extractToolName,
  normalizeHookPayload,
  readStdinSync,
} from './hook-payload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventName = process.argv[2] || '';
const stdinData = readStdinSync();
const payload = normalizeHookPayload(stdinData, process.env);

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

function toolInputJson() {
  return JSON.stringify(extractToolInput(payload));
}

function childEnv() {
  return {
    ...process.env,
    HOOK_INPUT: stdinData || JSON.stringify(payload),
    TOOL_INPUT: toolInputJson(),
  };
}

function runScript(scriptName, args = []) {
  const scriptPath = path.join(__dirname, scriptName);
  // prompt-dispatcher 는 명시적 외부 LLM 호출(hook 모드 최대 ~50s)을 포함할 수 있어
  // 그보다 약간 긴 timeout 으로 감싼다. 나머지 경량 스크립트는 30s. (B-2 정합 —
  // 30s 고정이면 prompt-dispatcher 의 외부 LLM 호출을 다시 hard-kill 한다)
  const timeout = scriptName.includes('prompt-dispatcher') ? 55000 : 30000;
  return spawnSync(process.execPath, [scriptPath, ...args], {
    input: stdinData || JSON.stringify(payload),
    encoding: 'utf-8',
    env: childEnv(),
    timeout,
  });
}

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeAdditionalContext(text) {
  if (!text) return;
  writeJson({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: text,
    },
  });
}

function mappedToolName() {
  const toolName = extractToolName(payload, '');
  if (toolName === 'apply_patch') return 'Edit';
  if (toolName === 'shell') return 'Bash';
  return toolName;
}

function handlePreToolUse() {
  const result = runScript('pre-tool-dispatcher.js', [mappedToolName()]);
  const output = combinedOutput(result);
  if (result.status === 2) {
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: output || 'vibe pre-tool guard denied this operation',
      },
    });
    process.exit(2);
  }
  writeAdditionalContext(output);
}

function handleUserPromptSubmit() {
  if (!extractPrompt(payload)) return;
  const result = runScript('prompt-dispatcher.js');
  writeAdditionalContext(combinedOutput(result));
}

function handlePostToolUse() {
  const result = runScript('post-edit-dispatcher.js');
  const output = combinedOutput(result);
  if (!output) return;
  // 디스패처가 이미 JSON hookSpecificOutput을 출력한 경우 그대로 전달 (이중 래핑 방지).
  // 그 외(plain text)는 Codex 어댑터 표준 방식으로 래핑.
  try {
    const parsed = JSON.parse(output);
    if (parsed?.hookSpecificOutput) {
      writeJson(parsed);
      return;
    }
  } catch { /* not JSON — fall through to text wrap */ }
  writeAdditionalContext(output);
}

function handleStop() {
  // Turn-complete side effects stay on Codex notify to avoid duplicate commits.
}

/**
 * PreCompact → context-save.
 *
 * CC 는 `Notification` 의 context_window_80/90/95 matcher 로 임계치마다 저장한다.
 * Codex 에는 그 알림이 없어 압축 전 체크포인트가 아예 저장되지 않았다 — 압축으로
 * 컨텍스트가 날아가도 복원 지점이 없었다.
 *
 * PreCompact 는 임계치 추정이 아니라 "지금 압축한다"는 확정 신호라 오히려 정확하다.
 * urgency 는 `high` — 압축이 임박했으므로 medium 보다 강하되, 세션 종료 직전은
 * 아니므로 critical 은 아니다. context-save 자체가 30s 디바운스를 가지므로
 * 연속 압축에도 중복 저장되지 않는다.
 */
function handlePreCompact() {
  runScript('context-save.js', ['high']);
  // stdout 주입 없음 — 압축 직전에 컨텍스트를 더 늘리는 것은 역효과다.
}

/**
 * PostCompact → ANCHOR 재고정.
 *
 * loop-contract 는 ANCHOR 의 존재 이유를 "컨텍스트가 오염되거나 compact 로 소실돼도
 * 루프는 깨지지 않는다" 로 규정한다. 그런데 정작 **압축 직후 자동 재고정이 없었다** —
 * 모델이 스스로 `anchor` 를 다시 부르기를 기대하는 상태였다. 압축은 그 기대가 가장
 * 깨지기 쉬운 순간이다(방금 지시를 잃은 참이다).
 *
 * PreCompact 가 압축 **전** 체크포인트를 저장한다면, PostCompact 는 압축 **후**
 * 디스크에서 사실을 다시 읽어 컨텍스트에 넣는다. 둘은 짝이다.
 *
 * 재고정 결과는 additionalContext 로 주입한다 — 압축 직후는 컨텍스트가 비어 있어
 * 주입 비용이 가장 싸고 효용이 가장 크다.
 */
function handlePostCompact() {
  const out = combinedOutput(runScript('loop-ledger.js', ['anchor']));
  if (out && out.trim()) {
    writeAdditionalContext('[vibe] ANCHOR (post-compact re-anchor):\n' + out.trim());
  }
}

switch (eventName) {
  case 'SessionStart':
    writeAdditionalContext(combinedOutput(runScript('session-start.js')));
    break;
  case 'UserPromptSubmit':
    handleUserPromptSubmit();
    break;
  case 'PreToolUse':
    handlePreToolUse();
    break;
  case 'PostToolUse':
    handlePostToolUse();
    break;
  case 'Stop':
    handleStop();
    break;
  case 'PreCompact':
    handlePreCompact();
    break;
  case 'PostCompact':
    handlePostCompact();
    break;
  default:
    break;
}

process.exit(0);
