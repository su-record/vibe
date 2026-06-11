#!/usr/bin/env node
/**
 * Sentinel Guard — PreToolUse hook
 * 핵심 자율 기계 경로를 Write/Edit/Bash 로부터 보호한다.
 * pre-tool-guard.js 이전에 실행된다.
 *
 * 보호 경로 결정 근거:
 *   src/infra/lib/autonomy/ 는 레포에 존재하지 않는 팬텀 경로였다.
 *   git log 와 src/ 전수 조사 결과, 자율 기계(evolution machinery)의 실제
 *   위치는 src/infra/lib/evolution/ 이다. GuardAnalyzer·HookTraceReader 등이
 *   hook-traces.jsonl을 분석해 하네스 자기 개선 인사이트를 생성한다.
 *   따라서 sentinel 대상을 이 실존 경로로 교체한다.
 *
 *   추가로 hooks/scripts/lib/ (디스패처 인프라)도 보호 — 이 디렉토리의
 *   hook-context.js / dispatcher.js 가 손상되면 모든 pre-tool 게이트가
 *   무력화된다.
 *
 * exit 2 = deny 규약 (PreToolUse 차단).
 */

const SENTINEL_PREFIXES = [
  'src/infra/lib/evolution/',
  'hooks/scripts/lib/',
];

// 빠른 prefix 검사용 정규식 (backslash 포함)
const SENTINEL_PATH_RE =
  /^(?:\.[\\/])?(?:src[\\/]infra[\\/]lib[\\/]evolution|hooks[\\/]scripts[\\/]lib)[\\/]/;

const DANGEROUS_BASH_RE =
  /\b(rm\s+-rf|kill\s+-9|drop\s+table|truncate|shutdown|reboot|mkfs|dd\s+if=)\b/i;

/**
 * Extract file path from tool input
 */
function extractFilePath(toolName, input) {
  if (!input) return null;
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Read') {
      return parsed.file_path || parsed.filePath || null;
    }
  } catch {
    return typeof input === 'string' ? input : null;
  }
  return null;
}

/**
 * Extract command from Bash tool input
 */
function extractBashCommand(input) {
  if (!input) return null;
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return parsed.command || null;
  } catch {
    return typeof input === 'string' ? input : null;
  }
}

/**
 * Check if path targets sentinel files
 */
function isSentinelPath(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return SENTINEL_PREFIXES.some(p => normalized.startsWith(p)) ||
    SENTINEL_PATH_RE.test(filePath);
}

/**
 * Main guard logic
 */
function guard(toolName, toolInput) {
  // Write/Edit targeting sentinel files → block
  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = extractFilePath(toolName, toolInput);
    if (isSentinelPath(filePath)) {
      return {
        decision: 'block',
        reason: `Sentinel files are protected. Cannot modify: ${filePath}`,
      };
    }
  }

  // Bash targeting sentinel files or dangerous commands
  if (toolName === 'Bash') {
    const command = extractBashCommand(toolInput);
    if (command && isSentinelPath(command)) {
      return {
        decision: 'block',
        reason: `Sentinel files are protected. Dangerous command targeting sentinel path.`,
      };
    }
    if (command && DANGEROUS_BASH_RE.test(command)) {
      if (SENTINEL_PREFIXES.some(p => command.includes(p))) {
        return {
          decision: 'block',
          reason: `Dangerous command targeting sentinel path: ${command}`,
        };
      }
    }
  }

  return undefined;
}

import { logHookDecision } from './utils.js';
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';

/**
 * in-process 진입점 — 디스패처가 ctx를 전달해 직접 호출.
 * @param {{ toolName: string, toolInput: string }} ctx
 * @returns {Promise<number>} exit code (2 = deny 규약, 0 = allow)
 */
export async function run(ctx) {
  const result = guard(ctx.toolName, ctx.toolInput);
  if (result) {
    logHookDecision('sentinel-guard', ctx.toolName, 'block', result.reason);
    console.log(JSON.stringify(result));
    return 2;
  }
  return 0;
}

// standalone CLI 모드 (antigravity-hooks.json / 기존 테스트): stdin JSON 우선, argv 폴백
if (isDirectRun(import.meta.url)) {
  process.exit(await run(buildCliCtx()));
}
