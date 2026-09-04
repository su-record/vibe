import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, readText, writeAtomic } from '../core/store.js';

/**
 * The repository is the plugin. One generator writes every marketplace surface from package.json,
 * so the three install paths (Claude Code marketplace · Codex/ChatGPT marketplace · npm) cannot
 * drift apart: `vibe plugin build` writes the files, `vibe plugin build --check` is the CI gate.
 */
interface Pkg {
  version: string;
  description: string;
}

function pkg(): Pkg {
  const p = readJson<Pkg>(path.join(packageRoot(), 'package.json'));
  return { version: p?.version ?? '0.0.0', description: p?.description ?? '' };
}

const AUTHOR = { name: 'su-record', url: 'https://github.com/su-record' };
const REPO = 'https://github.com/su-record/vibe';

function hookSet(root: string, sessionArg: string): Record<string, unknown> {
  const cmd = (file: string, arg: string): { type: 'command'; command: string; timeout: number } => ({ type: 'command', command: `node "${root}/hooks/${file}" ${arg}`, timeout: 90 });
  return {
    hooks: {
      SessionStart: [{ hooks: [cmd('session.js', sessionArg)] }],
      PostToolUse: [{ matcher: 'Edit|Write|MultiEdit|NotebookEdit', hooks: [{ ...cmd('notify.js', 'post --plugin'), timeout: 20 }] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [{ ...cmd('notify.js', 'pre --plugin'), timeout: 20 }] }],
    },
  };
}

export function codexManifest(p: Pkg = pkg()): Record<string, unknown> {
  return {
    name: 'vibe',
    version: p.version,
    description: p.description,
    author: AUTHOR,
    homepage: REPO,
    repository: REPO,
    license: 'MIT',
    keywords: ['harness', 'ax', 'fde', 'verification', 'codex', 'chatgpt'],
    skills: './skills/',
    hooks: './hooks/codex-hooks.json',
    interface: {
      displayName: 'Vibe',
      shortDescription: 'The harness judges; a human approves',
      longDescription: 'Say what you need. vibe turns it into checkable scenarios, builds it, proves it by running the checks itself, and hands it over. Start with /vibe.',
      developerName: 'su-record',
      category: 'Developer Tools',
      websiteURL: REPO,
      defaultPrompt: ['Use vibe to turn this request into approved scenarios and build it.', 'Use vibe to prove the current work with vibe check --all.'],
    },
  };
}

/** Every generated file, path → content. Keys are repository-relative. */
export function pluginTree(p: Pkg = pkg()): Record<string, string> {
  const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;
  return {
    '.claude-plugin/plugin.json': json({ name: 'vibe', version: p.version, description: p.description, author: AUTHOR, homepage: REPO, repository: REPO, license: 'MIT', keywords: ['harness', 'ax', 'fde', 'verification', 'claude-code'] }),
    '.claude-plugin/marketplace.json': json({ name: 'vibe', owner: AUTHOR, metadata: { description: p.description, version: p.version }, plugins: [{ name: 'vibe', source: './', description: p.description, version: p.version, category: 'productivity' }] }),
    '.codex-plugin/plugin.json': json(codexManifest(p)),
    '.agents/plugins/marketplace.json': json({ name: 'vibe', interface: { displayName: 'Vibe' }, plugins: [{ name: 'vibe', source: { source: 'local', path: './' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Developer Tools' }] }),
    'hooks/hooks.json': json(hookSet('${CLAUDE_PLUGIN_ROOT}', 'claude')),
    'hooks/codex-hooks.json': json(hookSet('${PLUGIN_ROOT}', 'codex')),
  };
}

export function writePluginTree(root: string = packageRoot()): string[] {
  const written: string[] = [];
  for (const [file, content] of Object.entries(pluginTree())) {
    if (readText(path.join(root, file)) === content) continue;
    writeAtomic(path.join(root, file), content);
    written.push(file);
  }
  return written;
}

/** Files whose committed content differs from what the generator would write now. */
export function checkPluginTree(root: string = packageRoot()): string[] {
  return Object.entries(pluginTree()).filter(([file, content]) => readText(path.join(root, file)) !== content).map(([file]) => file);
}

export function pluginTreeFiles(): string[] {
  return Object.keys(pluginTree());
}

export function hasPluginTree(root: string = packageRoot()): boolean {
  return pluginTreeFiles().every((f) => fs.existsSync(path.join(root, f)));
}
