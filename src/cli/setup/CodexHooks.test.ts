import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildCodexHooksConfig, installProjectCodexHooks } from './CodexHooks.js';

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
});
