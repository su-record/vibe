#!/usr/bin/env node
/**
 * Sentinel Guard — PreToolUse hook
 * Protects sentinel files and blocks dangerous operations.
 * Runs before pre-tool-guard.js.
 */

const SENTINEL_PATH_PREFIX = 'src/infra/lib/autonomy/';

const SENTINEL_PATH_RE = /^(\.\/|\.\\)?src[\\/]infra[\\/]lib[\\/]autonomy[\\/]/;

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
    // Not JSON, try as plain string
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
  return normalized.startsWith(SENTINEL_PATH_PREFIX) || SENTINEL_PATH_RE.test(filePath);
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
      // Check if command targets sentinel files
      if (command.includes(SENTINEL_PATH_PREFIX) || command.includes('src/infra/lib/autonomy')) {
        return {
          decision: 'block',
          reason: `Dangerous command targeting sentinel path: ${command}`,
        };
      }
    }
  }

  // Allow — return undefined for normal flow
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
