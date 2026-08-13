import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatHookStatus, formatNativeDepStatus, showHelp, showStatus } from './info.js';

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

  it('Codex 를 안 쓰는 프로젝트에서는 Codex 행을 내지 않는다', () => {
    expect(formatHookStatus(tempProject(), false)).not.toContain('Codex');
  });

  it('아티팩트가 있으면 Codex 행을 낸다', () => {
    const codex = tempProject();
    fs.writeFileSync(path.join(codex, 'AGENTS.md'), '# project\n');
    expect(formatHookStatus(codex, false)).toContain('Codex');
    expect(formatHookStatus(codex, false)).toContain('not installed');
  });

  /**
   * `.codex/` 와 `AGENTS.md` 는 gitignore 대상이라 fresh clone 에는 없다.
   * 아티팩트로만 판정하면 정작 보고해야 할 미설치 상태에서 행이 사라진다 —
   * `vibe init` 과 같은 기준(Codex CLI 설치 여부)으로 판정한다.
   */
  it('아티팩트가 없어도 Codex CLI 가 있으면 미설치를 보고한다', () => {
    const fresh = tempProject();
    const output = formatHookStatus(fresh, true);
    expect(output).toContain('Codex');
    expect(output).toContain('not installed');
  });
});

/**
 * npm 12 의 allowScripts 가 install 스크립트를 막으면 설치는 ✅ 인데 바인딩만 없다.
 * 상태 화면이 침묵하면 "메모리가 왜 안 붙지" 를 진단할 방법이 없다.
 */
describe('formatNativeDepStatus', () => {
  const tempRoot = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-native-status-'));

  it('바인딩이 있으면 ok 를 낸다', () => {
    const root = tempRoot();
    fs.mkdirSync(path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release'),
      { recursive: true });
    fs.writeFileSync(
      path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
      '');
    expect(formatNativeDepStatus(root)).toContain('✓');
  });

  it('소스만 있고 바인딩이 없으면 무엇이 죽는지까지 말한다', () => {
    const root = tempRoot();
    fs.mkdirSync(path.join(root, 'node_modules', 'better-sqlite3'), { recursive: true });
    const out = formatNativeDepStatus(root);
    expect(out).toContain('better-sqlite3');
    expect(out).toContain('memory/RAG disabled');
  });
});
