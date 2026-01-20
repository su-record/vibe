#!/usr/bin/env node
/**
 * Post-Tool Verify
 * 도구 실행 후 결과 검증 및 에러 복구 힌트 제공
 *
 * Inspired by oh-my-claudecode's PostToolUse hooks
 */

import { VIBE_PATH, PROJECT_DIR } from './utils.js';

// 에러 패턴 및 복구 힌트
const ERROR_RECOVERY_HINTS = {
  // Edit 에러
  'old_string not found': {
    hint: 'The text to replace was not found. Common causes:',
    suggestions: [
      'File was modified since last read - re-read the file first',
      'Whitespace mismatch (tabs vs spaces, trailing spaces)',
      'Line endings differ (CRLF vs LF)',
      'Text spans multiple lines - try smaller chunks',
    ],
    action: 'Read the file again to get the current content',
  },
  'not unique': {
    hint: 'Multiple matches found for old_string.',
    suggestions: [
      'Include more surrounding context to make it unique',
      'Use replace_all: true if you want to replace all occurrences',
      'Add line numbers or function names for context',
    ],
    action: 'Expand the old_string to include more unique context',
  },

  // Bash 에러
  'command not found': {
    hint: 'Command is not installed or not in PATH.',
    suggestions: [
      'Check if the package is installed',
      'Try using the full path to the command',
      'For npm packages, ensure node_modules/.bin is in PATH or use npx',
    ],
    action: 'Install the required package or use an alternative command',
  },
  'permission denied': {
    hint: 'Insufficient permissions for this operation.',
    suggestions: [
      'Check file/directory permissions',
      'For sudo operations, ensure user has proper access',
      'On Windows, run as Administrator if needed',
    ],
    action: 'Check and fix permissions, or use a different approach',
  },
  'ENOENT': {
    hint: 'File or directory does not exist.',
    suggestions: [
      'Verify the path is correct',
      'Create parent directories first with mkdir -p',
      'Check for typos in the path',
    ],
    action: 'Create the missing directories or fix the path',
  },
  'EACCES': {
    hint: 'Access denied to file or directory.',
    suggestions: [
      'Check file ownership and permissions',
      'Ensure the directory is not read-only',
    ],
    action: 'Fix permissions or choose a different location',
  },

  // Git 에러
  'merge conflict': {
    hint: 'Git merge conflict detected.',
    suggestions: [
      'Review conflicting files',
      'Choose which changes to keep',
      'Use git mergetool for complex conflicts',
    ],
    action: 'Resolve conflicts in the marked files, then git add and commit',
  },
  'detached HEAD': {
    hint: 'Git is in detached HEAD state.',
    suggestions: [
      'Create a branch to save your work: git checkout -b new-branch',
      'Return to a branch: git checkout main',
    ],
    action: 'Create a branch if you want to keep changes',
  },
  'diverged': {
    hint: 'Local and remote branches have diverged.',
    suggestions: [
      'Pull with rebase: git pull --rebase',
      'Or merge: git pull',
      'Review differences first: git log HEAD..origin/main',
    ],
    action: 'Decide whether to rebase or merge',
  },

  // TypeScript/Build 에러
  'Cannot find module': {
    hint: 'Module import failed.',
    suggestions: [
      'Run npm install to ensure dependencies are installed',
      'Check if the module path is correct',
      'For local modules, verify the file exists',
      'Check tsconfig.json paths configuration',
    ],
    action: 'Install missing dependencies or fix the import path',
  },
  'Type error': {
    hint: 'TypeScript type mismatch.',
    suggestions: [
      'Check the expected type in the function/variable definition',
      'Use type assertion if confident (value as Type)',
      'Add proper type guards for union types',
    ],
    action: 'Fix the type mismatch or add proper type handling',
  },
};

// 성공 패턴 감지
const SUCCESS_PATTERNS = [
  /✓|✅|success|passed|complete|done/i,
  /^0 errors?$/im,
  /all tests passed/i,
  /build succeeded/i,
];

/**
 * 출력에서 에러 감지 및 힌트 생성
 */
function analyzeOutput(toolName, output, exitCode) {
  const result = {
    hasError: exitCode !== 0,
    hints: [],
    suggestions: [],
    recoveryAction: null,
  };

  // 성공 패턴 확인
  if (SUCCESS_PATTERNS.some(p => p.test(output))) {
    result.hasError = false;
    return result;
  }

  // 에러 패턴 매칭
  for (const [pattern, recovery] of Object.entries(ERROR_RECOVERY_HINTS)) {
    if (output.toLowerCase().includes(pattern.toLowerCase())) {
      result.hints.push(recovery.hint);
      result.suggestions.push(...recovery.suggestions);
      if (!result.recoveryAction) {
        result.recoveryAction = recovery.action;
      }
    }
  }

  // 에러가 감지됐는데 힌트가 없으면 일반 힌트 제공
  if (result.hasError && result.hints.length === 0) {
    result.hints.push('An error occurred. Check the output for details.');
    result.suggestions.push(
      'Review the full error message',
      'Search for the error message online',
      'Check if similar issues exist in the project',
    );
  }

  return result;
}

/**
 * 출력 포맷
 */
function formatRecoveryHint(toolName, analysis) {
  if (!analysis.hasError || analysis.hints.length === 0) {
    return '';
  }

  const lines = [];
  lines.push(`💡 POST-TOOL HINT: ${toolName} encountered an issue`);
  lines.push('');

  for (const hint of analysis.hints) {
    lines.push(`📌 ${hint}`);
  }

  if (analysis.suggestions.length > 0) {
    lines.push('');
    lines.push('Possible solutions:');
    for (const suggestion of analysis.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
  }

  if (analysis.recoveryAction) {
    lines.push('');
    lines.push(`🔧 Recommended action: ${analysis.recoveryAction}`);
  }

  return lines.join('\n');
}

// 메인 실행
const toolName = process.argv[2] || 'unknown';
const exitCode = parseInt(process.argv[3] || '0', 10);
const output = process.argv[4] || process.env.TOOL_OUTPUT || '';

const analysis = analyzeOutput(toolName, output, exitCode);
const hint = formatRecoveryHint(toolName, analysis);

if (hint) {
  console.log(hint);
}
