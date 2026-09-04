import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseTokenPolicy, readConfig, writeConfig } from '../core/config.js';
import { usage } from '../core/errors.js';
import { globalStatus, uninstallGlobal, uninstallProjectSurfaces } from '../install/global.js';
import { buildMcpb } from '../install/mcpb.js';
import { installPlugin, pluginStatus } from '../install/plugin.js';
import { ensureProject, projectStatus, purgeProject } from '../install/project.js';
import { checkPluginTree, writePluginTree } from '../install/tree.js';
import { checkUpdate, runUpdate } from '../install/update.js';
import { flagString, packageVersion, type Flags, type Output } from './common.js';

export function cmdTokens(root: string, policyRaw: string | undefined): Output {
  if (policyRaw) {
    ensureProject(root);
    writeConfig(root, { tokens: parseTokenPolicy(policyRaw) });
  }
  const policy = readConfig(root).tokens;
  return { json: { tokens: policy }, text: `tokens: ${policy}`, code: 0 };
}

export function cmdStatus(root: string, flags: Flags): Output {
  const g = globalStatus(flagString(flags, 'home'));
  const p = projectStatus(root);
  const update = process.env['VIBE_OFFLINE'] ? { installed: packageVersion(), latest: null, available: false } : checkUpdate();
  const lines = [
    `vibe ${packageVersion()} — ${g.home}`,
    ...Object.entries(g.clients).map(([client, c]) => `  ${client.padEnd(9)} ${c.mode === 'plugin' ? `plugin ${c.pluginVersion ?? 'not installed'}` : `home · card ${c.card ? 'ok' : '-'} · skills ${c.skills} · hook ${c.hook ? 'ok' : '-'}`}${c.current ? '' : ' — stale; any vibe command repairs it'}`),
    `  card      ${g.cardBytes} bytes${g.cardOver ? ' — over 1KB!' : ''}`,
    ...(update.available ? [`  update    ${update.latest} available — \`vibe update\``] : []),
    `project   ${p.root}`,
    `  .vibe     ${p.vibe ? 'ok' : 'none yet — the first record creates it'}`,
    `  state     ${p.state}`,
    `  inbox     ${p.inboxOpen} open`,
  ];
  return { json: { version: packageVersion(), ...g, project: p, update }, text: lines.join('\n'), code: 0 };
}

export function cmdUpdate(flags: Flags): Output {
  if (flags['check'] === true) {
    const c = checkUpdate();
    const text = c.latest === null ? `installed ${c.installed} · registry unreachable` : c.available ? `${c.installed} → ${c.latest} available — run \`vibe update\`` : `${c.installed} is current`;
    return { json: c, text, code: 0 };
  }
  const r = runUpdate();
  if (!r.updated) return { json: r, text: r.detail, code: r.latest === null ? 2 : 0 };
  // The new binary registers the plugins itself; run it once so the report shows the new state.
  const after = spawnSync('vibe', ['status'], { encoding: 'utf-8', timeout: 120_000, shell: process.platform === 'win32' });
  const tail = after.status === 0 ? after.stdout.trim() : `run \`vibe status\` to finish the setup`;
  return { json: { ...r, status: after.stdout }, text: `updated ${r.detail}\n${tail}`, code: 0 };
}

export function cmdUninstall(root: string, flags: Flags): Output {
  const home = uninstallGlobal(flagString(flags, 'home'));
  const project = uninstallProjectSurfaces(root);
  if (flags['purge-state'] === true && purgeProject(root)) project.push('.vibe/');
  const removed = [...home, ...project.map((r) => path.join(path.relative(process.cwd(), root) || '.', r))];
  return { json: { removed, home, project, root }, text: removed.length ? `removed: ${removed.join(', ')}` : 'nothing to remove', code: 0 };
}

export function cmdPlugin(sub: string | undefined, flags: Flags): Output {
  const home = flagString(flags, 'home');
  if (sub === 'mcpb') {
    const r = buildMcpb(flagString(flags, 'out') ?? 'vibe.mcpb');
    return { json: r, text: `${r.file} · ${r.bytes} bytes · vibe ${r.version}\n  open it in the Claude desktop app (macOS · Windows), pick the project folder; the app needs the vibe CLI: npm i -g @su-record/vibe`, code: 0 };
  }
  if (sub === 'build') {
    if (flags['check'] === true) {
      const drift = checkPluginTree();
      return { json: { drift }, text: drift.length ? `plugin tree drift — run \`vibe plugin build\`:\n  ${drift.join('\n  ')}` : 'plugin tree matches package.json', code: drift.length ? 1 : 0 };
    }
    const written = writePluginTree();
    return { json: { written }, text: written.length ? `wrote ${written.join(', ')}` : 'plugin tree already current', code: 0 };
  }
  if (sub === 'install') {
    const r = installPlugin(home);
    const text = [
      `plugin ${r.version} → ${r.tree}`,
      `  files       ${r.files.join(', ')}`,
      `  marketplace ${r.marketplace}`,
      '  next:',
      ...r.next.map((n) => `    ${n}`),
    ].join('\n');
    return { json: r, text, code: 0 };
  }
  if (sub === 'status') {
    const r = pluginStatus(home);
    const text = [
      `plugin tree ${r.exists ? 'ok' : 'missing'} — ${r.tree}`,
      `  manifest ${r.manifestVersion ?? '-'} · package ${r.packageVersion} · skills ${r.skills} · hooks ${r.hooks ? 'ok' : '-'} · registered ${r.registered ? 'yes' : 'no'}`,
      ...(r.drift.length ? r.drift.map((d) => `  drift: ${d}`) : ['  no drift']),
    ].join('\n');
    return { json: r, text, code: r.drift.length ? 1 : 0 };
  }
  throw usage('plugin build [--check] | plugin mcpb [--out vibe.mcpb] | plugin install | plugin status [--home <dir>]');
}
