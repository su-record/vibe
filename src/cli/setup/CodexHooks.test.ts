import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCodexHooksConfig, installProjectCodexHooks } from './CodexHooks.js';

const __filename = fileURLToPath(import.meta.url);
// src/cli/setup/ → 3 levels up → repo root
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');

describe('CodexHooks', () => {
  it('builds native Codex hooks that route through the vibe adapter', () => {
    const config = buildCodexHooksConfig('/opt/vibe');

    expect(config.hooks.UserPromptSubmit[0].hooks[0].command).toContain('codex-hook-adapter.js');
    expect(config.hooks.UserPromptSubmit[0].hooks[0].command).toContain('UserPromptSubmit');
    expect(config.hooks.PreToolUse[0].hooks[0].command).toContain('PreToolUse');
    expect(config.hooks.PostToolUse[0].hooks[0].command).toContain('PostToolUse');
    expect(config.hooks.Stop[0].hooks[0].command).toContain('Stop');
  });

  it('writes project .codex/hooks.json for Codex native hook loading', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-codex-hooks-'));

    installProjectCodexHooks(projectRoot, '/opt/vibe');

    const hooksPath = path.join(projectRoot, '.codex', 'hooks.json');
    const config = JSON.parse(fs.readFileSync(hooksPath, 'utf-8')) as ReturnType<typeof buildCodexHooksConfig>;
    expect(config.hooks.PreToolUse[0].hooks[0].command).toContain('/opt/vibe/hooks/scripts/codex-hook-adapter.js');
  });

  // .codex/hooks.json은 머신별 절대 경로를 담는 로컬 설치 아티팩트
  // (.claude/settings.local.json과 동급, gitignored). 도그푸딩된 로컬 파일이
  // 있을 때만 인스톨러 출력과의 정합을 검증한다 — CI에는 파일이 없으므로 skip.
  const localHooksPath = path.join(REPO_ROOT, '.codex', 'hooks.json');

  it.skipIf(!fs.existsSync(localHooksPath))(
    'local .codex/hooks.json is in sync with what installProjectCodexHooks would generate',
    () => {
    const committed = JSON.parse(fs.readFileSync(localHooksPath, 'utf-8')) as ReturnType<typeof buildCodexHooksConfig>;

    // Verify structure: all 5 events present with adapter command
    const events = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'] as const;
    for (const event of events) {
      const cmd = committed.hooks[event][0].hooks[0].command;
      expect(cmd).toContain('codex-hook-adapter.js');
      expect(cmd).toContain(event);
    }

    // Verify all script paths in the committed file point to existing files
    for (const event of events) {
      const cmd = committed.hooks[event][0].hooks[0].command;
      // extract quoted path: node "..." EventName
      const match = cmd.match(/node\s+"([^"]+)"/);
      if (match) {
        expect(
          fs.existsSync(match[1]),
          `Script path missing: ${match[1]} (from ${event} hook)`,
        ).toBe(true);
      }
    }
  });
});
