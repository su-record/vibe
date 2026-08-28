import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { extractPostinstallReport, readInstalledLLMStatus, repairProjectHooks } from './upgrade.js';
import { buildCodexHooksConfig } from '../setup.js';

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

  /**
   * Codex 분기가 **부재만** 보던 회귀를 막는다.
   *
   * 실측(v3.2.59): `PostCompact` 가 추가된 버전으로 upgrade 해도 이미 설치된
   * `.codex/hooks.json` 은 `PreCompact` 까지만 남아 있었다 — 파일을 지운 뒤
   * 재실행해야 복구됐다. `.claude` 는 같은 상황을 이미 복구하고 있었다.
   */
  function codexProjectWithHooks(): { root: string; hooksPath: string } {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# project\n');
    repairProjectHooks(root);
    return { root, hooksPath: path.join(root, '.codex', 'hooks.json') };
  }

  function readCodexHooks(hooksPath: string): Record<string, unknown> {
    const parsed = JSON.parse(fs.readFileSync(hooksPath, 'utf-8')) as {
      hooks?: Record<string, unknown>;
    };
    return parsed.hooks ?? {};
  }

  it('repairs Codex hooks when the installed file drifts from the current definition', () => {
    const { root, hooksPath } = codexProjectWithHooks();
    // 옛 정의를 하드코딩하지 않는다 — 정의가 또 바뀌면 픽스처가 먼저 썩는다.
    // 지금 설치본에서 이벤트 하나를 떼어내 "구버전" 을 만든다.
    const drifted = readCodexHooks(hooksPath);
    delete drifted.PostCompact;
    fs.writeFileSync(hooksPath, JSON.stringify({ hooks: drifted }, null, 2) + '\n');

    const repaired = repairProjectHooks(root);

    expect(repaired).toContain('.codex/hooks.json (stale)');
    expect(Object.keys(readCodexHooks(hooksPath))).toContain('PostCompact');
    expect(readCodexHooks(hooksPath)).toEqual(buildCodexHooksConfig().hooks);
  });

  it('leaves Codex hooks alone when the installed file already matches', () => {
    const { root } = codexProjectWithHooks();

    expect(repairProjectHooks(root)).toEqual([]);
  });

  it('repairs a Codex hooks file that has no hooks key, preserving other keys', () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# project\n');
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    const hooksPath = path.join(root, '.codex', 'hooks.json');
    fs.writeFileSync(hooksPath, JSON.stringify({ mcpServers: { demo: {} } }, null, 2));

    const repaired = repairProjectHooks(root);

    // 파일은 있었지만 훅은 없었다 — stale 이 아니라 미설치다
    expect(repaired).toContain('.codex/hooks.json');
    expect(repaired).not.toContain('.codex/hooks.json (stale)');
    const parsed = JSON.parse(fs.readFileSync(hooksPath, 'utf-8')) as {
      hooks?: unknown;
      mcpServers?: unknown;
    };
    expect(parsed.hooks).toBeDefined();
    expect(parsed.mcpServers).toEqual({ demo: {} });
  });

  it('treats an unreadable Codex hooks file as not-installed rather than stale', () => {
    const root = tempProject();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# project\n');
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    const hooksPath = path.join(root, '.codex', 'hooks.json');
    fs.writeFileSync(hooksPath, '{ this is not json');

    const repaired = repairProjectHooks(root);

    expect(repaired).toContain('.codex/hooks.json');
    expect(readCodexHooks(hooksPath)).toEqual(buildCodexHooksConfig().hooks);
  });

  it('still reports Claude hook drift as stale — no regression on the reference branch', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    repairProjectHooks(root);

    const settingsPath = path.join(root, '.claude', 'settings.local.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
      hooks: Record<string, unknown>;
    };
    delete settings.hooks.PreToolUse;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    expect(repairProjectHooks(root)).toContain('.claude/settings.local.json (stale)');
  });
});

/**
 * `vibe upgrade` 는 npm 출력을 pipe 로 숨기는데, 그 과정에서 postinstall 의 보고성
 * 라인까지 삼켜졌다. "철회된 스킬 파일을 지웠다" 가 사라지면 삭제가 조용해진다 —
 * pruneExtraneousSkillFiles 가 제거 목록을 반환하게 만든 이유가 무효화된다.
 */
describe('extractPostinstallReport', () => {
  it('surfaces the pruned-files report line', () => {
    const npmOutput = [
      'added 1 package in 3s',
      '   stale skill files pruned: vibe.run/references/ralph-loop.md',
      'npm notice New major version available',
    ].join('\n');

    expect(extractPostinstallReport(npmOutput)).toEqual([
      'stale skill files pruned: vibe.run/references/ralph-loop.md',
    ]);
  });

  it('surfaces optional-skill removals', () => {
    const npmOutput = '   optional skill removed: vibe.presentation\n';

    expect(extractPostinstallReport(npmOutput)).toEqual([
      'optional skill removed: vibe.presentation',
    ]);
  });

  it('drops npm noise so the upgrade result is not buried', () => {
    const npmOutput = [
      'npm warn deprecated foo@1.0.0',
      'added 42 packages',
      'changed 3 packages in 5s',
    ].join('\n');

    expect(extractPostinstallReport(npmOutput)).toEqual([]);
  });

  it('returns nothing for empty output', () => {
    expect(extractPostinstallReport('')).toEqual([]);
  });
});
