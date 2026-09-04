import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { ensureDir, readJson, writeJson } from '../core/store.js';

/**
 * OpenAI plugin for Codex CLI and ChatGPT desktop — one tree, one personal marketplace.
 *
 * The tree carries no node_modules: its hooks call the globally installed `vibe` CLI. vibe 3 copied
 * 300MB into the Codex cache because the whole package was the plugin; here the plugin is only the
 * manifest, the six common skills and the notification hooks.
 */
const SKILL_NAMES = ['vibe', 'vibe.discover', 'vibe.scope', 'vibe.build', 'vibe.prove', 'vibe.handoff'] as const;
export const MARKETPLACE_NAME = 'vibe-local';

export interface PluginPaths {
  home: string;
  tree: string;
  marketplace: string;
}

export function pluginPaths(home: string = os.homedir()): PluginPaths {
  return {
    home,
    tree: path.join(home, '.vibe', 'plugin', 'vibe'),
    marketplace: path.join(home, '.agents', 'plugins', 'marketplace.json'),
  };
}

function packageVersion(): string {
  return readJson<{ version: string }>(path.join(packageRoot(), 'package.json'))?.version ?? '0.0.0';
}

function manifest(version: string): Record<string, unknown> {
  return {
    name: 'vibe',
    version,
    description: 'An AX/FDE harness for Claude Code, Codex CLI and ChatGPT desktop. Say what you need, approve the scenarios once; the harness proves the work by running the checks itself. Memory in plain files, human tokens for irreversible actions, a ledger instead of claims.',
    author: { name: 'su-record', url: 'https://github.com/su-record' },
    homepage: 'https://github.com/su-record/vibe',
    repository: 'https://github.com/su-record/vibe',
    license: 'MIT',
    keywords: ['harness', 'ax', 'fde', 'verification', 'codex', 'chatgpt'],
    skills: './skills/',
    hooks: './hooks/hooks.json',
    interface: {
      displayName: 'Vibe',
      shortDescription: 'The harness judges; a human approves',
      longDescription: 'Say what you need. vibe turns it into checkable scenarios, builds it, proves it by running the checks itself, and hands it over. Start with /vibe.',
      developerName: 'su-record',
      category: 'Developer Tools',
      websiteURL: 'https://github.com/su-record/vibe',
      defaultPrompt: ['Use vibe to turn this request into approved scenarios and build it.', 'Use vibe to prove the current work with vibe check --all.'],
    },
  };
}

function pluginHooks(): Record<string, unknown> {
  const hook = (mode: 'post' | 'pre'): { type: 'command'; command: string; timeout: number } => ({
    type: 'command',
    command: `node "\${PLUGIN_ROOT}/hooks/notify.js" ${mode}`,
    timeout: 20,
  });
  return {
    hooks: {
      PostToolUse: [{ matcher: 'Edit|Write|MultiEdit|NotebookEdit', hooks: [hook('post')] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [hook('pre')] }],
    },
  };
}

/** Rebuild the tree from scratch — a stale file in the cache is worse than a slow install. */
export function assemblePlugin(tree: string): string[] {
  fs.rmSync(tree, { recursive: true, force: true });
  ensureDir(tree);
  const written: string[] = [];
  const version = packageVersion();
  writeJson(path.join(tree, '.codex-plugin', 'plugin.json'), manifest(version));
  written.push('.codex-plugin/plugin.json');
  for (const name of SKILL_NAMES) {
    const from = path.join(packageRoot(), 'skills', name);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(tree, 'skills', name), { recursive: true });
    written.push(`skills/${name}`);
  }
  writeJson(path.join(tree, 'hooks', 'hooks.json'), pluginHooks());
  written.push('hooks/hooks.json');
  fs.copyFileSync(path.join(packageRoot(), 'hooks', 'notify.js'), path.join(tree, 'hooks', 'notify.js'));
  written.push('hooks/notify.js');
  fs.writeFileSync(path.join(tree, 'README.md'), `# vibe ${version}\n\nAssembled by \`vibe plugin install\`. Do not edit — rerun the command instead.\nHooks call the globally installed \`vibe\` CLI; the verdict is always \`vibe check\`.\n`, 'utf-8');
  written.push('README.md');
  return written;
}

interface MarketplaceDoc {
  name?: string;
  interface?: unknown;
  plugins?: Array<{ name?: string; [key: string]: unknown }>;
}

/** Register the tree in the personal marketplace Codex and ChatGPT desktop both read. Other plugins are kept. */
export function writeMarketplace(paths: PluginPaths): { file: string; marketplaceName: string } {
  const doc: MarketplaceDoc = readJson<MarketplaceDoc>(paths.marketplace) ?? {};
  doc.name ??= MARKETPLACE_NAME;
  doc.interface ??= { displayName: 'Vibe (local)' };
  const plugins = Array.isArray(doc.plugins) ? doc.plugins : [];
  const entry = {
    name: 'vibe',
    source: { source: 'local', path: `./${path.relative(paths.home, paths.tree).replace(/\\/g, '/')}` },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Developer Tools',
  };
  const index = plugins.findIndex((p) => p?.name === 'vibe');
  if (index === -1) plugins.push(entry);
  else plugins[index] = entry;
  doc.plugins = plugins;
  writeJson(paths.marketplace, doc);
  return { file: paths.marketplace, marketplaceName: doc.name };
}

export interface PluginInstallReport {
  tree: string;
  marketplace: string;
  marketplaceName: string;
  files: string[];
  version: string;
  next: string[];
}

export function installPlugin(home?: string): PluginInstallReport {
  const paths = pluginPaths(home);
  const files = assemblePlugin(paths.tree);
  const { marketplaceName } = writeMarketplace(paths);
  return {
    tree: paths.tree,
    marketplace: paths.marketplace,
    marketplaceName,
    files,
    version: packageVersion(),
    next: [
      `codex plugin marketplace add ${paths.home}`,
      `codex plugin add vibe@${marketplaceName}`,
      'ChatGPT desktop reads the same marketplace file — restart the app to see the plugin',
    ],
  };
}

export interface PluginStatusReport {
  tree: string;
  exists: boolean;
  manifestVersion: string | null;
  packageVersion: string;
  skills: number;
  hooks: boolean;
  registered: boolean;
  drift: string[];
}

export function pluginStatus(home?: string): PluginStatusReport {
  const paths = pluginPaths(home);
  const exists = fs.existsSync(paths.tree);
  const manifestVersion = readJson<{ version?: string }>(path.join(paths.tree, '.codex-plugin', 'plugin.json'))?.version ?? null;
  const version = packageVersion();
  const skillsDir = path.join(paths.tree, 'skills');
  const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter((n) => n === 'vibe' || n.startsWith('vibe.')).length : 0;
  const hooks = fs.existsSync(path.join(paths.tree, 'hooks', 'hooks.json')) && fs.existsSync(path.join(paths.tree, 'hooks', 'notify.js'));
  const marketplace = readJson<MarketplaceDoc>(paths.marketplace);
  const registered = Boolean(marketplace?.plugins?.some((p) => p?.name === 'vibe'));
  const drift: string[] = [];
  if (!exists) drift.push('plugin tree missing — run `vibe plugin install`');
  if (exists && manifestVersion !== version) drift.push(`manifest ${manifestVersion ?? 'none'} ≠ package ${version}`);
  if (exists && skills !== SKILL_NAMES.length) drift.push(`skills ${skills} ≠ ${SKILL_NAMES.length}`);
  if (exists && !hooks) drift.push('hooks missing');
  if (!registered) drift.push('not registered in the personal marketplace');
  return { tree: paths.tree, exists, manifestVersion, packageVersion: version, skills, hooks, registered, drift };
}
