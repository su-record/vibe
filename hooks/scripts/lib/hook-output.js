/**
 * Claude Code / coco 공용 훅 JSON 출력 헬퍼.
 *
 * 훅은 두 방식으로 에이전트에 신호를 줄 수 있음:
 *   1. stderr + exit 2      — 레거시. 메시지가 assistant context 에 주입되고 재시도 유도.
 *   2. stdout JSON + exit 0 — 신식. `decision`, `reason`, `systemMessage`,
 *                              `hookSpecificOutput.additionalContext` 등 구조화 필드로
 *                              에이전트 행동을 정밀 제어.
 *
 * 본 헬퍼는 (2) 방식을 일관된 형태로 찍어주는 얇은 래퍼. stderr 는 사용자용,
 * JSON 은 assistant 용으로 분리하는 관례(Claude Code hook docs)를 따른다.
 *
 * 참고: `suppressOutput: true` 는 stdout 을 transcript 에서만 감추지
 * assistant 에는 여전히 들어감. 따라서 stderr 로 사용자 메시지를 보내야 한다.
 */

/** Print a JSON object to stdout as a single line. */
function emitJSON(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

/**
 * PreToolUse 훅: 도구 실행을 허용/차단.
 *
 * @param {"approve"|"block"} decision
 * @param {string} reason                사용자/assistant 에게 보이는 사유
 * @param {object} [opts]
 * @param {string} [opts.systemMessage]  assistant 컨텍스트에 추가 주입할 메시지
 * @param {boolean} [opts.suppressOutput] transcript 숨김 (기본 false)
 */
export function emitPreToolDecision(decision, reason, opts = {}) {
  const out = {
    decision,
    reason,
    hookSpecificOutput: { hookEventName: 'PreToolUse' },
  };
  if (opts.systemMessage) out.systemMessage = opts.systemMessage;
  if (opts.suppressOutput) out.suppressOutput = true;
  emitJSON(out);
}

/**
 * PostToolUse 훅: 결과 피드백 / 후속 작업 지시.
 *
 * @param {object} opts
 * @param {"block"} [opts.decision]      "block" 이면 에이전트가 재시도/수정 유도
 * @param {string} [opts.reason]         block 사유
 * @param {string} [opts.systemMessage]  assistant 컨텍스트에 주입할 메시지
 * @param {string} [opts.additionalContext]  hookSpecificOutput.additionalContext 로 주입
 */
export function emitPostToolOutput(opts = {}) {
  const out = { hookSpecificOutput: { hookEventName: 'PostToolUse' } };
  if (opts.decision) out.decision = opts.decision;
  if (opts.reason) out.reason = opts.reason;
  if (opts.systemMessage) out.systemMessage = opts.systemMessage;
  if (opts.additionalContext) out.hookSpecificOutput.additionalContext = opts.additionalContext;
  if (opts.suppressOutput) out.suppressOutput = true;
  emitJSON(out);
}

/**
 * UserPromptSubmit 훅: 프롬프트 검증/수정 또는 추가 컨텍스트 주입.
 *
 * @param {object} opts
 * @param {"block"} [opts.decision]          block 이면 프롬프트 자체 차단
 * @param {string} [opts.reason]             block 사유 (사용자에게 표시)
 * @param {string} [opts.additionalContext]  프롬프트 턴에 추가될 시스템 메시지
 * @param {boolean} [opts.suppressOutput]    transcript 숨김
 */
export function emitUserPromptOutput(opts = {}) {
  const out = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' } };
  if (opts.decision) out.decision = opts.decision;
  if (opts.reason) out.reason = opts.reason;
  if (opts.additionalContext) out.hookSpecificOutput.additionalContext = opts.additionalContext;
  if (opts.suppressOutput) out.suppressOutput = true;
  emitJSON(out);
}

/**
 * Stop 훅: 응답 종료를 막고 에이전트에 재시도 지시.
 *
 * 루프 방지: stdin 페이로드의 `stop_hook_active === true` 이면 이미 한번 블록한 상태.
 * 호출자는 `shouldEnforceStop(payload)` 로 가드 필요.
 *
 * @param {string} reason   재시도 사유 (어떤 조건이 미충족인지 구체적으로)
 */
export function emitStopBlock(reason) {
  emitJSON({
    decision: 'block',
    reason,
    hookSpecificOutput: { hookEventName: 'Stop' },
  });
}

/**
 * Stop 훅 루프 방지: payload.stop_hook_active 가 이미 true 면 재블록 금지.
 * Claude Code 가 루프 감지용으로 주입하는 플래그.
 */
export function shouldEnforceStop(payload) {
  if (!payload || typeof payload !== 'object') return true;
  return !payload.stop_hook_active;
}

/**
 * stdin 에서 훅 페이로드(JSON) 를 읽어 반환. 파싱 실패 시 null.
 * (Claude Code / coco 둘 다 JSON 페이로드를 stdin 으로 넘김.)
 */
export async function readHookPayload() {
  if (process.stdin.isTTY) return null;
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  if (!data.trim()) return null;
  try { return JSON.parse(data); }
  catch { return null; }
}
