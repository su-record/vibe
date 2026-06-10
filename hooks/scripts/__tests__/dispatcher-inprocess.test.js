/**
 * in-process 디스패처 외부 계약 테스트
 *
 * SPEC: .vibe/specs/hook-dispatcher-inprocess.md
 * 디스패처를 Claude Code와 동일하게 CLI로 spawn하여 검증한다 —
 * 내부 구현(in-process)이 아니라 외부 계약(exit code, stdout 주입)이 대상.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRE_DISPATCHER = path.resolve(__dirname, '..', 'pre-tool-dispatcher.js');
const POST_DISPATCHER = path.resolve(__dirname, '..', 'post-edit-dispatcher.js');

/**
 * 디스패처를 stdin 페이로드와 함께 실행. { stdout, exitCode } 반환.
 */
function runDispatcher(script, args, payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  try {
    const stdout = execFileSync('node', [script, ...args], {
      encoding: 'utf-8',
      input,
      timeout: 15000,
      // scope.json이 없는 격리된 cwd에서 실행 (scope-guard no-op 보장)
      env: { ...process.env, CLAUDE_PROJECT_DIR: __dirname },
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), exitCode: err.status };
  }
}

describe('pre-tool-dispatcher (in-process)', () => {
  it('AC-1: 위험 Bash 명령은 exit 2로 deny', () => {
    const { exitCode } = runDispatcher(PRE_DISPATCHER, ['Bash'], {
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    });
    expect(exitCode).toBe(2);
  });

  it('AC-2: sentinel 경로 Edit은 exit 2 + stdout에 block JSON 주입', () => {
    const { stdout, exitCode } = runDispatcher(PRE_DISPATCHER, ['Edit'], {
      tool_name: 'Edit',
      tool_input: { file_path: 'src/infra/lib/autonomy/core.ts', old_string: 'a', new_string: 'b' },
    });
    expect(exitCode).toBe(2);
    expect(stdout).toContain('"decision":"block"');
  });

  it('AC-3: 안전한 Bash 명령은 exit 0', () => {
    const { exitCode } = runDispatcher(PRE_DISPATCHER, ['Bash'], {
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    });
    expect(exitCode).toBe(0);
  });

  it('AC-3: 안전한 Edit은 exit 0 (scope.json 없음 → scope-guard no-op)', () => {
    const { exitCode } = runDispatcher(PRE_DISPATCHER, ['Edit'], {
      tool_name: 'Edit',
      tool_input: { file_path: 'src/cli/index.ts', old_string: 'a', new_string: 'b' },
    });
    expect(exitCode).toBe(0);
  });

  it('AC-2 변형: 위험 명령이 sentinel 경로를 노리면 sentinel-guard가 차단', () => {
    const { exitCode } = runDispatcher(PRE_DISPATCHER, ['Bash'], {
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf src/infra/lib/autonomy/' },
    });
    expect(exitCode).toBe(2);
  });
});

describe('post-edit-dispatcher (in-process)', () => {
  it('AC-4: 손상된 stdin(비JSON)에도 exit 0 (fail-open)', () => {
    const { exitCode } = runDispatcher(POST_DISPATCHER, [], 'not-json');
    expect(exitCode).toBe(0);
  });

  it('AC-4: 빈 페이로드에도 exit 0', () => {
    const { exitCode } = runDispatcher(POST_DISPATCHER, [], {});
    expect(exitCode).toBe(0);
  });

  it('존재하지 않는 파일 경로 페이로드에도 exit 0 (step 내부 격리)', () => {
    const { exitCode } = runDispatcher(POST_DISPATCHER, [], {
      tool_name: 'Edit',
      tool_input: { file_path: '/nonexistent/__vibe_test__.xyz' },
    });
    expect(exitCode).toBe(0);
  });
});
