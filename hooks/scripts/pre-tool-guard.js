#!/usr/bin/env node
/**
 * Pre-Tool Guard
 * 위험한 도구 사용 전 검증 및 경고
 */

import { VIBE_PATH, PROJECT_DIR } from './utils.js';

// 위험한 명령어 패턴
const DANGEROUS_PATTERNS = {
  bash: [
    { pattern: /rm\s+-rf?\s+[\/~]/, severity: 'critical', message: 'Deleting root or home directory' },
    { pattern: /rm\s+-rf?\s+\*/, severity: 'high', message: 'Wildcard deletion detected' },
    { pattern: /git\s+push\s+.*--force/, severity: 'high', message: 'Force push detected' },
    { pattern: /git\s+reset\s+--hard/, severity: 'medium', message: 'Hard reset will discard changes' },
    { pattern: /drop\s+(table|database)/i, severity: 'critical', message: 'Database drop detected' },
    { pattern: /truncate\s+table/i, severity: 'high', message: 'Table truncate detected' },
    { pattern: /:(){ :|:& };:/, severity: 'critical', message: 'Fork bomb detected' },
    { pattern: /mkfs|fdisk|dd\s+if=/, severity: 'critical', message: 'Disk operation detected' },
    { pattern: /chmod\s+-R\s+777/, severity: 'medium', message: 'Insecure permission change' },
    { pattern: /curl.*\|\s*(ba)?sh/, severity: 'high', message: 'Piping curl to shell' },
  ],
  edit: [
    { pattern: /\.env|credentials|secret|password|api[_-]?key/i, severity: 'medium', message: 'Editing sensitive file' },
    { pattern: /package-lock\.json|yarn\.lock|pnpm-lock/, severity: 'low', message: 'Editing lock file directly' },
  ],
  write: [
    { pattern: /\.env|credentials|secret/i, severity: 'medium', message: 'Writing to sensitive file' },
    { pattern: /\/etc\/|\/usr\/|C:\\Windows/i, severity: 'critical', message: 'Writing to system directory' },
  ],
};

// 안전한 대안 제안
const SAFE_ALTERNATIVES = {
  'rm -rf': 'Use trash-cli (trash-put) or move to a backup directory first',
  'git push --force': 'Use git push --force-with-lease instead',
  'git reset --hard': 'Create a backup branch first: git branch backup-$(date +%s)',
  'drop table': 'Consider soft delete or backup first',
  'chmod 777': 'Use specific permissions (e.g., chmod 755 for directories)',
};

/**
 * 명령어 검증
 */
function validateCommand(toolName, input) {
  const results = {
    allowed: true,
    severity: 'none',
    warnings: [],
    suggestions: [],
  };

  const patterns = DANGEROUS_PATTERNS[toolName.toLowerCase()] || [];

  for (const { pattern, severity, message } of patterns) {
    if (pattern.test(input)) {
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

      // 대안 제안
      for (const [dangerous, safe] of Object.entries(SAFE_ALTERNATIVES)) {
        if (input.includes(dangerous)) {
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

// 메인 실행
const toolName = process.argv[2] || 'Bash';
const toolInput = process.argv[3] || process.env.TOOL_INPUT || '';

const validation = validateCommand(toolName, toolInput);
const output = formatOutput(toolName, validation);

if (output) {
  console.log(output);
}

// Exit code: 0 = allowed, 1 = blocked
process.exit(validation.allowed ? 0 : 1);
