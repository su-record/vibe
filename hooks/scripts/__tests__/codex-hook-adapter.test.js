import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADAPTER = path.resolve(__dirname, '..', 'codex-hook-adapter.js');

describe('codex-hook-adapter', () => {
  it('converts a PreToolUse denial into Codex permission output', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-adapter-'));
    const payload = JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'rm -rf /' },
    });

    const result = spawnSync(process.execPath, [ADAPTER, 'PreToolUse'], {
      cwd,
      input: payload,
      encoding: 'utf-8',
      timeout: 5000,
    });

    expect(result.status).toBe(2);
    const output = JSON.parse(result.stdout.trim());
    expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain('Deleting root or home directory');
  });

  /**
   * Codex 에는 CC 의 context_window_* Notification 등가물이 없어, PreCompact 를
   * 붙이기 전까지 압축 전 체크포인트가 아예 저장되지 않았다.
   */
  it('handles PreCompact without failing or injecting context', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-precompact-'));

    const result = spawnSync(process.execPath, [ADAPTER, 'PreCompact'], {
      cwd,
      input: JSON.stringify({ cwd }),
      encoding: 'utf-8',
      timeout: 30000,
    });

    expect(result.status).toBe(0);
    // 압축 직전에 컨텍스트를 더 늘리면 역효과 — stdout 주입이 없어야 한다
    expect(result.stdout.trim()).toBe('');
  });

  it('ignores unknown events instead of erroring', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-unknown-'));

    const result = spawnSync(process.execPath, [ADAPTER, 'SubagentStop'], {
      cwd,
      input: JSON.stringify({ cwd }),
      encoding: 'utf-8',
      timeout: 10000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
