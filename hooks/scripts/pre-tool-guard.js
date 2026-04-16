#!/usr/bin/env node
/**
 * Pre-Tool Guard
 * 위험한 도구 사용 전 검증 및 경고
 */

import { VIBE_PATH, PROJECT_DIR } from './utils.js';

// 위험한 명령어 패턴
//
// 각 엔트리의 `target`은 매칭 대상 필드:
//   - 'command'   → tool_input.command (Bash)
//   - 'file_path' → tool_input.file_path (Write, Edit)
//   - 'raw'       → 전체 문자열 (스키마 모를 때 폴백)
//
// 예전 버전은 항상 stringify된 tool_input 전체에 매칭하여 file content가
// 패턴(예: /etc/, .env)과 일치하면 false positive로 차단되는 버그가 있었음.
// 회귀: .claude/vibe/regressions/pre-tool-guard-content-false-positive.md
const DANGEROUS_PATTERNS = {
  bash: [
    // `/` or `~` must be the *entire* argument (optionally followed by `*`, `/`, or `/*`).
    // Prevents false positives on safe absolute paths like `/tmp/foo` or `/Users/me/proj`.
    // The lookahead requires an arg boundary (whitespace, shell separator, or end-of-string).
    { pattern: /rm\s+-rf?\s+(\/|\/\*|~|~\/|~\/\*)(?=\s|[;&|]|$)/, target: 'command', severity: 'critical', message: 'Deleting root or home directory' },
    { pattern: /rm\s+-rf?\s+\*/, target: 'command', severity: 'high', message: 'Wildcard deletion detected' },
    { pattern: /git\s+push\s+.*--force/, target: 'command', severity: 'high', message: 'Force push detected' },
    { pattern: /git\s+reset\s+--hard/, target: 'command', severity: 'medium', message: 'Hard reset will discard changes' },
    { pattern: /drop\s+(table|database)/i, target: 'command', severity: 'critical', message: 'Database drop detected' },
    { pattern: /truncate\s+table/i, target: 'command', severity: 'high', message: 'Table truncate detected' },
    { pattern: /:(){ :|:& };:/, target: 'command', severity: 'critical', message: 'Fork bomb detected' },
    { pattern: /mkfs|fdisk|dd\s+if=/, target: 'command', severity: 'critical', message: 'Disk operation detected' },
    { pattern: /chmod\s+-R\s+777/, target: 'command', severity: 'medium', message: 'Insecure permission change' },
    { pattern: /curl.*\|\s*(ba)?sh/, target: 'command', severity: 'high', message: 'Piping curl to shell' },
  ],
  edit: [
    { pattern: /\.env|credentials|secret|password|api[_-]?key/i, target: 'file_path', severity: 'medium', message: 'Editing sensitive file' },
    { pattern: /package-lock\.json|yarn\.lock|pnpm-lock/, target: 'file_path', severity: 'low', message: 'Editing lock file directly' },
  ],
  write: [
    { pattern: /\.env|credentials|secret/i, target: 'file_path', severity: 'medium', message: 'Writing to sensitive file' },
    { pattern: /\/etc\/|\/usr\/|C:\\Windows/i, target: 'file_path', severity: 'critical', message: 'Writing to system directory' },
  ],
};

// 도구 입력 스키마 검증 (경량 — 외부 의존성 없음)
const TOOL_INPUT_SCHEMAS = {
  Bash: { required: ['command'], types: { command: 'string', timeout: 'number' } },
  Read: { required: ['file_path'], types: { file_path: 'string', offset: 'number', limit: 'number' } },
  Edit: { required: ['file_path', 'old_string', 'new_string'], types: { file_path: 'string', old_string: 'string', new_string: 'string' } },
  Write: { required: ['file_path', 'content'], types: { file_path: 'string', content: 'string' } },
  Glob: { required: ['pattern'], types: { pattern: 'string', path: 'string' } },
  Grep: { required: ['pattern'], types: { pattern: 'string', path: 'string' } },
};

function validateInputSchema(toolName, rawInput) {
  const schema = TOOL_INPUT_SCHEMAS[toolName];
  if (!schema) return { valid: true, errors: [] }; // 스키마 없으면 통과

  let input;
  try {
    input = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
  } catch {
    return { valid: true, errors: [] }; // JSON 아니면 레거시 모드 — 통과
  }
  if (typeof input !== 'object' || !input) return { valid: true, errors: [] };

  const errors = [];
  // 필수 필드 검증
  for (const field of schema.required || []) {
    if (input[field] === undefined || input[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  // 타입 검증
  for (const [field, expectedType] of Object.entries(schema.types || {})) {
    if (input[field] !== undefined && typeof input[field] !== expectedType) {
      errors.push(`Field '${field}' expected ${expectedType}, got ${typeof input[field]}`);
    }
  }
  // 경로 검증 (path traversal 기본 방어)
  if (input.file_path && typeof input.file_path === 'string') {
    if (input.file_path.includes('\0')) errors.push('Null byte in file_path');
  }

  return { valid: errors.length === 0, errors };
}

// 안전한 대안 제안
const SAFE_ALTERNATIVES = {
  'rm -rf': 'Use trash-cli (trash-put) or move to a backup directory first',
  'git push --force': 'Use git push --force-with-lease instead',
  'git reset --hard': 'Create a backup branch first: git branch backup-$(date +%s)',
  'drop table': 'Consider soft delete or backup first',
  'chmod 777': 'Use specific permissions (e.g., chmod 755 for directories)',
};

/**
 * 패턴 매칭 대상 추출
 *
 * tool_input이 객체이면 target 필드만 뽑아 반환. 객체가 아니거나(레거시 argv 모드)
 * target='raw'이면 입력 전체를 그대로 반환.
 *
 * 핵심: write/edit 패턴은 file_path만 봐야 한다. content에 우연히 들어간
 * 리터럴(예: 코드 안의 '/etc/machine-id' 문자열)이 차단을 일으키지 않도록.
 */
function extractTarget(rawInput, target) {
  if (target === 'raw') return typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);

  // 객체로 파싱 시도
  let obj = rawInput;
  if (typeof rawInput === 'string') {
    try {
      obj = JSON.parse(rawInput);
    } catch {
      // JSON 아님 → 레거시 argv 모드. argv[3]은 보통 file_path 또는 command 단일 문자열.
      // 안전하게 그 문자열을 target 값으로 간주.
      return rawInput;
    }
  }

  if (typeof obj !== 'object' || obj === null) return '';
  const value = obj[target];
  return typeof value === 'string' ? value : '';
}

/**
 * 명령어 검증
 */
function validateCommand(toolName, rawInput) {
  const results = {
    allowed: true,
    severity: 'none',
    warnings: [],
    suggestions: [],
  };

  const patterns = DANGEROUS_PATTERNS[toolName.toLowerCase()] || [];

  for (const { pattern, target, severity, message } of patterns) {
    const haystack = extractTarget(rawInput, target || 'raw');
    if (!haystack) continue;

    if (pattern.test(haystack)) {
      results.warnings.push(`[${severity.toUpperCase()}] ${message}`);

      // 심각도에 따른 처리
      if (severity === 'critical') {
        results.allowed = false;
        results.severity = 'critical';
      } else if (severity === 'high' && results.severity !== 'critical') {
        results.severity = 'high';
      } else if (results.severity === 'none') {
        results.severity = severity;
      }

      // 대안 제안 — 매칭된 target 필드에서만 검색
      for (const [dangerous, safe] of Object.entries(SAFE_ALTERNATIVES)) {
        if (haystack.includes(dangerous)) {
          results.suggestions.push(safe);
        }
      }
    }
  }

  return results;
}

/**
 * 출력 포맷
 */
function formatOutput(toolName, validation) {
  const lines = [];

  if (validation.warnings.length === 0) {
    return ''; // 경고 없으면 출력 없음
  }

  lines.push(`⚠️ PRE-TOOL GUARD: ${toolName}`);

  for (const warning of validation.warnings) {
    lines.push(`  ${warning}`);
  }

  if (validation.suggestions.length > 0) {
    lines.push('');
    lines.push('💡 Suggestions:');
    for (const suggestion of validation.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  if (!validation.allowed) {
    lines.push('');
    lines.push('🚫 BLOCKED: This operation is too dangerous. Please review and modify.');
  }

  return lines.join('\n');
}

/**
 * stdin에서 JSON 페이로드 읽기 (Claude Code 하네스 호환)
 * stdin이 없거나 파싱 실패 시 argv/env 폴백
 */
function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    // fd 0을 직접 사용 (Windows는 '/dev/stdin'이 없음)
    const buf = Buffer.alloc(65536);
    const bytesRead = fs.readSync(0, buf, 0, buf.length, null);
    if (bytesRead > 0) {
      return JSON.parse(buf.toString('utf-8', 0, bytesRead));
    }
  } catch { /* 파싱 실패 시 폴백 */ }
  return null;
}

import fs from 'fs';

// 메인 실행: stdin JSON 우선, argv 폴백
const stdinPayload = readStdinSync();
const toolName = stdinPayload?.tool_name || process.argv[2] || 'Bash';
const toolInput = stdinPayload?.tool_input
  ? (typeof stdinPayload.tool_input === 'string'
    ? stdinPayload.tool_input
    : JSON.stringify(stdinPayload.tool_input))
  : (process.argv[3] || process.env.TOOL_INPUT || '');

import { logHookDecision } from './utils.js';

// 1단계: 입력 스키마 검증 (구조적 오류 탐지)
const schemaResult = validateInputSchema(toolName, stdinPayload?.tool_input || toolInput);
if (!schemaResult.valid) {
  // stderr: Claude Code surfaces stderr in hook-error notifications; stdout is injected
  // into the assistant's context and never shown to the user. Guard messages target the user.
  console.error(`⚠️ INPUT VALIDATION: ${toolName}`);
  for (const err of schemaResult.errors) {
    console.error(`  [SCHEMA] ${err}`);
  }
  logHookDecision('pre-tool-guard', toolName, 'warn', `schema: ${schemaResult.errors.join('; ')}`);
  // 스키마 오류는 경고만 (차단하지 않음 — 레거시 호환)
}

// 2단계: 위험 패턴 검증 (보안 탐지)
const validation = validateCommand(toolName, toolInput);
const output = formatOutput(toolName, validation);

if (output) {
  console.error(output);
}

// Hook trace logging
if (!validation.allowed) {
  logHookDecision('pre-tool-guard', toolName, 'block', validation.warnings.join('; '));
} else if (validation.warnings.length > 0) {
  logHookDecision('pre-tool-guard', toolName, 'warn', validation.warnings.join('; '));
}

// Exit code: 0 = allowed, 2 = denied (claw-code 규약), 1 = 레거시 호환
process.exit(validation.allowed ? 0 : 2);
