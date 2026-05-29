import fs from 'fs';
import path from 'path';
import { ensureDir } from '../utils.js';
import { getCoreConfigDir } from './GlobalInstaller.js';

interface CodexHookCommand {
  type: 'command';
  command: string;
}

interface CodexHookEntry {
  hooks: CodexHookCommand[];
}

export interface CodexHooksConfig {
  hooks: {
    SessionStart: CodexHookEntry[];
    UserPromptSubmit: CodexHookEntry[];
    PreToolUse: CodexHookEntry[];
    PostToolUse: CodexHookEntry[];
    Stop: CodexHookEntry[];
  };
}

function adapterCommand(coreDir: string, eventName: string): string {
  const scriptPath = path.join(coreDir, 'hooks', 'scripts', 'codex-hook-adapter.js').replace(/\\/g, '/');
  return `node ${JSON.stringify(scriptPath)} ${eventName}`;
}

function hookEntry(coreDir: string, eventName: string): CodexHookEntry {
  return {
    hooks: [{ type: 'command', command: adapterCommand(coreDir, eventName) }],
  };
}

export function buildCodexHooksConfig(coreDir: string = getCoreConfigDir()): CodexHooksConfig {
  const normalizedCoreDir = coreDir.replace(/\\/g, '/');
  return {
    hooks: {
      SessionStart: [hookEntry(normalizedCoreDir, 'SessionStart')],
      UserPromptSubmit: [hookEntry(normalizedCoreDir, 'UserPromptSubmit')],
      PreToolUse: [hookEntry(normalizedCoreDir, 'PreToolUse')],
      PostToolUse: [hookEntry(normalizedCoreDir, 'PostToolUse')],
      Stop: [hookEntry(normalizedCoreDir, 'Stop')],
    },
  };
}

function readExistingHooks(hooksPath: string): Record<string, unknown> {
  try {
    if (!fs.existsSync(hooksPath)) return {};
    const parsed: unknown = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function installProjectCodexHooks(
  projectRoot: string,
  coreDir: string = getCoreConfigDir(),
): void {
  const codexDir = path.join(projectRoot, '.codex');
  const hooksPath = path.join(codexDir, 'hooks.json');
  ensureDir(codexDir);

  const existing = readExistingHooks(hooksPath);
  const next = {
    ...existing,
    hooks: buildCodexHooksConfig(coreDir).hooks,
  };
  fs.writeFileSync(hooksPath, JSON.stringify(next, null, 2) + '\n');
}
