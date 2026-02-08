/**
 * claude_code Tool - Claude Code CLI 호출
 * Phase 3: Function Calling Tool Definitions
 *
 * 보안:
 * - workingDirectory는 프로젝트 루트 하위로 정규화 (path traversal 차단)
 * - 최소 환경변수만 전달
 * - 동기 실행 timeout: 30초
 */

import * as path from 'node:path';
import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

const SYNC_TIMEOUT_MS = 30_000;

function getProjectRoot(): string {
  return process.cwd();
}

// Long-running task keywords
const LONG_TASK_KEYWORDS = [
  '구현', '만들어', '리팩토링', '테스트 작성', 'implement',
  'create', 'refactor', 'write tests', 'build',
];

export const claudeCodeSchema = z.object({
  task: z.string().describe('Development task to execute'),
  workingDirectory: z.string().optional().describe('Working directory (relative to project root)'),
});

function isLongRunningTask(task: string): boolean {
  const lower = task.toLowerCase();
  return LONG_TASK_KEYWORDS.some((kw) => lower.includes(kw));
}

function sanitizeWorkingDir(dir: string | undefined): string {
  const projectRoot = getProjectRoot();
  if (!dir) return projectRoot;

  const resolved = path.resolve(projectRoot, dir);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error('workingDirectory must be within project root (path traversal blocked)');
  }
  return resolved;
}

async function handleClaudeCode(args: Record<string, unknown>): Promise<string> {
  const { task, workingDirectory } = args as z.infer<typeof claudeCodeSchema>;

  const cwd = sanitizeWorkingDir(workingDirectory);

  if (isLongRunningTask(task)) {
    return `[Job mode required] Task "${task.substring(0, 80)}" requires async execution. Use manage_jobs to track progress.`;
  }

  // Synchronous execution via child_process
  const { execFileSync } = await import('node:child_process');

  try {
    const result = execFileSync('claude', ['--print', task], {
      cwd,
      timeout: SYNC_TIMEOUT_MS,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME || process.env.USERPROFILE,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
      shell: false,
    });

    return result.trim() || '(no output)';
  } catch (err) {
    const error = err as { status?: number; stderr?: string; message: string };
    if (error.status === null) {
      return `Claude Code execution timed out after ${SYNC_TIMEOUT_MS / 1000}s`;
    }
    return `Claude Code error: ${error.stderr || error.message}`;
  }
}

export const claudeCodeTool: ToolRegistrationInput = {
  name: 'claude_code',
  description: 'Execute development tasks via Claude Code CLI (code analysis, file modifications, debugging)',
  schema: claudeCodeSchema,
  handler: handleClaudeCode,
  scope: 'execute',
};
