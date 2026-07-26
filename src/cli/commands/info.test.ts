import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatHookStatus, showHelp, showStatus } from './info.js';

const originalCwd = process.cwd();

function captureLog(run: () => void): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
    lines.push(String(message ?? ''));
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

describe('CLI info commands', () => {
  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('describes all supported harnesses in help output', () => {
    const output = captureLog(showHelp);

    expect(output).toContain('Claude Code / Codex / Antigravity');
    expect(output).toContain('vibe init --antigravity');
    expect(output).not.toContain(['Claude Code', 'exclusive'].join(' '));
    expect(output).not.toContain(['Gemini', 'CLI'].join(' '));
  });

  it('detects .vibe as the project status directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-status-'));
    fs.mkdirSync(path.join(tempDir, '.vibe'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, '.vibe', 'config.json'),
      JSON.stringify({ language: 'ko', models: {} }),
    );

    process.chdir(tempDir);
    const output = captureLog(showStatus);

    expect(output).toContain(`Project: ✅ ${fs.realpathSync(tempDir)}`);
    expect(output).not.toContain('Not a core project');
  });

  it('surfaces missing hooks in status output', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-status-hooks-'));
    fs.mkdirSync(path.join(tempDir, '.vibe'), { recursive: true });

    process.chdir(tempDir);
    const output = captureLog(showStatus);

    expect(output).toContain('Hooks (deterministic gates):');
    expect(output).toContain('not installed');
  });
});

/**
 * 훅 부재는 결정론적 가드가 전부 죽었다는 뜻이므로 상태 화면에서 반드시 보여야 한다.
 * `vibe upgrade` 만 쓰는 사용자가 이 상태에 도달할 수 있다 — repairProjectHooks 참조.
 */
describe('formatHookStatus', () => {
  function tempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-hookstatus-'));
  }

  it('reports Claude hooks as installed only when the hooks key exists', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'settings.local.json'),
      JSON.stringify({ permissions: {} }),
    );

    expect(formatHookStatus(root)).toContain('not installed');

    fs.writeFileSync(
      path.join(root, '.claude', 'settings.local.json'),
      JSON.stringify({ hooks: { PreToolUse: [] } }),
    );

    expect(formatHookStatus(root)).toContain('✓ .claude/settings.local.json');
  });

  it('reports Codex hooks only for Codex-enabled projects', () => {
    const plain = tempProject();
    expect(formatHookStatus(plain)).not.toContain('Codex');

    const codex = tempProject();
    fs.writeFileSync(path.join(codex, 'AGENTS.md'), '# project\n');
    expect(formatHookStatus(codex)).toContain('Codex');
    expect(formatHookStatus(codex)).toContain('not installed');
  });
});
