import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CARD_START, HOOK_FILES, hasNotifyHook, initProject, statusProject, uninstallProject } from './project.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-codex-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('vibe init --client codex', () => {
  it('installs the card into AGENTS.md, six skills into .codex/skills and notification hooks into .codex/hooks.json', () => {
    const report = initProject(root, ['codex']);
    expect(report.card['AGENTS.md']).toBe('created');
    expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf-8')).toContain(CARD_START);
    expect(report.skills['.codex/skills']).toHaveLength(6);
    expect(fs.existsSync(path.join(root, '.codex', 'skills', 'vibe.scope', 'SKILL.md'))).toBe(true);
    expect(report.hook[HOOK_FILES.codex]).toBe('added');
    const hooks = JSON.parse(fs.readFileSync(path.join(root, HOOK_FILES.codex), 'utf-8')) as { hooks: Record<string, unknown[]> };
    expect(Object.keys(hooks.hooks).sort()).toEqual(['PostToolUse', 'PreToolUse']);
    expect(hasNotifyHook(path.join(root, HOOK_FILES.codex))).toBe(true);
    // nothing for Claude was touched
    expect(fs.existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, HOOK_FILES.claude))).toBe(false);
  });

  it('chatgpt shares the Codex layout; a second init leaves existing hooks alone', () => {
    initProject(root, ['chatgpt']);
    const before = fs.readFileSync(path.join(root, HOOK_FILES.codex), 'utf-8');
    const again = initProject(root, ['codex']);
    expect(again.hook[HOOK_FILES.codex]).toBe('unchanged');
    expect(fs.readFileSync(path.join(root, HOOK_FILES.codex), 'utf-8')).toBe(before);
  });

  it('keeps a user hook that was already in .codex/hooks.json', () => {
    fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(root, HOOK_FILES.codex), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo bye' }] }] } }));
    initProject(root, ['codex']);
    const hooks = JSON.parse(fs.readFileSync(path.join(root, HOOK_FILES.codex), 'utf-8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    expect(hooks.hooks['Stop']?.[0]?.hooks[0]?.command).toBe('echo bye');
    expect(hooks.hooks['PostToolUse']).toHaveLength(1);
  });

  it('status and uninstall cover the Codex files', () => {
    initProject(root, ['claude', 'codex']);
    const status = statusProject(root);
    expect(status.cards).toEqual({ 'CLAUDE.md': true, 'AGENTS.md': true });
    expect(status.hooks).toEqual({ [HOOK_FILES.claude]: true, [HOOK_FILES.codex]: true });
    expect(status.skills).toEqual({ '.claude/skills': 6, '.codex/skills': 6 });
    const removed = uninstallProject(root, true);
    expect(removed).toContain(`${HOOK_FILES.codex} hook`);
    expect(removed).toContain('AGENTS.md card');
    expect(fs.existsSync(path.join(root, '.codex', 'skills', 'vibe'))).toBe(false);
    expect(fs.existsSync(path.join(root, '.vibe'))).toBe(true);
  });
});
