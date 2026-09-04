import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { packageRoot } from '../core/paths.js';
import { readJson } from '../core/store.js';

/**
 * `vibe update` — the update is an npm install, but the user should not have to know npm.
 * Asks the registry for the latest version, installs it globally when it differs, and lets the
 * new binary re-register the plugins (every command does that on its own).
 */
export const PACKAGE = '@su-record/vibe';
const VIEW_TIMEOUT_MS = 10_000;
const INSTALL_TIMEOUT_MS = 180_000;

function npm(args: string[], timeout: number): { ok: boolean; out: string } {
  const r = spawnSync('npm', args, { encoding: 'utf-8', timeout, shell: process.platform === 'win32' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

export function installedVersion(): string {
  return readJson<{ version: string }>(path.join(packageRoot(), 'package.json'))?.version ?? '0.0.0';
}

/** Latest published version, or null when the registry cannot be reached. Never throws. */
export function latestVersion(): string | null {
  const r = npm(['view', PACKAGE, 'version'], VIEW_TIMEOUT_MS);
  const v = r.out.split('\n').at(-1)?.trim() ?? '';
  return r.ok && /^\d+\.\d+\.\d+/.test(v) ? v : null;
}

export function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i += 1) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

export interface UpdateCheck {
  installed: string;
  latest: string | null;
  available: boolean;
}

export function checkUpdate(): UpdateCheck {
  const installed = installedVersion();
  const latest = latestVersion();
  return { installed, latest, available: latest !== null && newer(latest, installed) };
}

export interface UpdateResult extends UpdateCheck {
  updated: boolean;
  detail: string;
}

/** Install the latest version globally when one exists. The caller re-runs `vibe status` on the new binary. */
export function runUpdate(): UpdateResult {
  const check = checkUpdate();
  if (check.latest === null) return { ...check, updated: false, detail: 'the npm registry could not be reached — try again with a network' };
  if (!check.available) return { ...check, updated: false, detail: `already current (${check.installed})` };
  const r = npm(['i', '-g', `${PACKAGE}@${check.latest}`], INSTALL_TIMEOUT_MS);
  if (!r.ok) return { ...check, updated: false, detail: `npm install failed — run: npm i -g ${PACKAGE}@${check.latest}\n${r.out.slice(-300)}` };
  return { ...check, updated: true, detail: `${check.installed} → ${check.latest}` };
}
