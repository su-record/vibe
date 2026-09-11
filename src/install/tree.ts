import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson, readText, writeAtomic } from '../core/store.js';

/**
 * The package is the plugin. One generator writes every plugin manifest and hook file from
 * package.json, so the client surfaces cannot drift from the CLI: `vibe plugin build` writes the
 * files, `vibe plugin build --check` is the CI gate. Registration is local (see register.ts).
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
  const cmd = (file: string, arg: string): { type: 'command'; command: string; timeout: number } => ({ type: 'command', command: `node "${root}/hooks/${file}" ${arg}`, timeout: 5 });
  return {
    hooks: {
      SessionStart: [{ hooks: [cmd('session.js', sessionArg)] }],
      Stop: [{ hooks: [{ ...cmd('notify.js', 'stop --plugin --personal'), timeout: 5 }] }],
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ ...cmd('notify.js', 'pre --plugin --personal'), timeout: 20 }] },
      ],
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
      shortDescription: 'Your personal FDE',
      longDescription: 'Understand your work, use the right tools, implement and verify useful outcomes. Start with /vibe.',
      developerName: 'su-record',
      category: 'Developer Tools',
      websiteURL: REPO,
      defaultPrompt: ['Use vibe to help me solve this problem.', 'Use vibe to continue my project from its saved context.'],
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
