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

/**
 * PostCompact → ANCHOR 재고정 (2026-08-13).
 *
 * loop-contract 는 ANCHOR 의 존재 이유를 "compact 로 소실돼도 루프는 깨지지 않는다"
 * 로 규정하는데, 정작 **압축 직후 자동 재고정이 없었다** — 모델이 스스로 anchor 를
 * 다시 부르기를 기대하는 상태였다. 압축은 그 기대가 가장 깨지기 쉬운 순간이다.
 */
describe('PostCompact — 압축 직후 재고정', () => {
  it('디스크의 SPEC 을 additionalContext 로 되돌려준다', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-postcompact-'));
    try {
      fs.mkdirSync(path.join(cwd, '.vibe', 'specs'), { recursive: true });
      fs.writeFileSync(path.join(cwd, '.vibe', '.last-feature'), 'login\n');
      fs.writeFileSync(path.join(cwd, '.vibe', 'specs', 'login.md'), '# SPEC\n');

      const result = spawnSync(process.execPath, [ADAPTER, 'PostCompact'], {
        cwd, input: '{}', encoding: 'utf-8', timeout: 10000,
        env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
      });

      expect(result.status).toBe(0);
      const ctx = JSON.parse(result.stdout.trim()).hookSpecificOutput.additionalContext;
      expect(ctx).toContain('post-compact re-anchor');
      expect(ctx).toContain('login');
      expect(ctx).toContain('specs/login.md');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('재고정할 것이 없어도 exit 0 (fail-open)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-postcompact-'));
    try {
      const result = spawnSync(process.execPath, [ADAPTER, 'PostCompact'], {
        cwd, input: '{}', encoding: 'utf-8', timeout: 10000,
        env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
      });
      expect(result.status).toBe(0);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
