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

import fs from 'fs';

/**
 * stdin에서 JSON 페이로드 읽기 (Claude Code 하네스 호환)
 */
function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    const fd = fs.openSync('/dev/stdin', 'r');
    const buf = Buffer.alloc(65536);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
    fs.closeSync(fd);
    if (bytesRead > 0) {
      return JSON.parse(buf.toString('utf-8', 0, bytesRead));
    }
  } catch { /* 폴백 */ }
  return null;
}

// Main execution: stdin JSON 우선, argv 폴백
const stdinPayload = readStdinSync();
const toolName = stdinPayload?.tool_name || process.argv[2] || '';
const toolInput = stdinPayload?.tool_input
  ? (typeof stdinPayload.tool_input === 'string'
    ? stdinPayload.tool_input
    : JSON.stringify(stdinPayload.tool_input))
  : (process.argv[3] || process.env.TOOL_INPUT || '');

import { logHookDecision } from './utils.js';

const result = guard(toolName, toolInput);

if (result) {
  logHookDecision('sentinel-guard', toolName, 'block', result.reason);
  console.log(JSON.stringify(result));
  process.exit(2); // deny 규약
}

process.exit(0);
