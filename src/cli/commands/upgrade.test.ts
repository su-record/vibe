import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { readInstalledLLMStatus, repairProjectHooks } from './upgrade.js';

describe('upgrade command helpers', () => {
  it('reads LLM status from the newly installed package', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-upgrade-'));
    const authDir = path.join(tempRoot, '@su-record', 'vibe', 'dist', 'cli');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(
      path.join(authDir, 'auth.js'),
      'export function formatLLMStatus() { return "FRESH ANTIGRAVITY STATUS"; }\n',
    );

    expect(readInstalledLLMStatus(tempRoot)).toBe('FRESH ANTIGRAVITY STATUS');
  });
});

/**
 * `vibe upgrade` 만 쓰는 사용자에게 훅이 영원히 설치되지 않던 회귀를 막는다.
 * postinstall 은 전역 자산만 다루므로 훅 복구는 upgrade 가 책임진다.
 */
describe('repairProjectHooks', () => {
  function tempProject(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-hookrepair-'));
  }

  it('installs Claude hooks when .claude/ exists but settings.local.json is missing', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });

    const repaired = repairProjectHooks(root);

    expect(repaired).toContain('.claude/settings.local.json');
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf-8'),
    ) as { hooks?: Record<string, unknown> };
    expect(settings.hooks).toBeDefined();
    expect(Object.keys(settings.hooks ?? {})).toContain('PreToolUse');
  });

  it('installs Claude hooks when settings.local.json exists without a hooks key', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.claude', 'settings.local.json'),
      JSON.stringify({ permissions: { allow: ['Bash'] } }, null, 2),
    );

    const repaired = repairProjectHooks(root);

    expect(repaired).toContain('.claude/settings.local.json');
    const settings = JSON.parse(
      fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf-8'),
    ) as { hooks?: unknown; permissions?: unknown };
    expect(settings.hooks).toBeDefined();
    // 기존 키는 보존해야 한다 — 훅 복구가 사용자 설정을 지우면 안 된다
    expect(settings.permissions).toEqual({ allow: ['Bash'] });
  });

  it('installs Codex hooks when AGENTS.md marks the project as Codex-enabled', () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# project\n');

    const repaired = repairProjectHooks(root);

    expect(repaired).toContain('.codex/hooks.json');
    const config = JSON.parse(
      fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf-8'),
    ) as { hooks: Record<string, unknown> };
    expect(Object.keys(config.hooks)).toContain('PreToolUse');
  });

  it('is a no-op for a directory that is not a vibe project', () => {
    const root = tempProject();

    expect(repairProjectHooks(root)).toEqual([]);
    expect(fs.existsSync(path.join(root, '.claude'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.codex'))).toBe(false);
  });

  it('is idempotent — already-installed hooks are not reported as repaired', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# project\n');

    expect(repairProjectHooks(root).length).toBeGreaterThan(0);
    expect(repairProjectHooks(root)).toEqual([]);
  });
});
