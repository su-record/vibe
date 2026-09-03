import fs from 'node:fs';
import path from 'node:path';
import { detectClient, detectModel } from '../core/client.js';
import { openQuestions } from '../core/inbox.js';
import { record } from '../core/ledger.js';
import { vibePath } from '../core/paths.js';
import { emptyState, readState, statePath } from '../core/state.js';
import { ensureDir, writeAtomic, writeJson } from '../core/store.js';

/**
 * `.vibe/` is the only thing vibe puts inside a repository: the state that is also the handoff.
 * There is no init command — the first command that writes a record creates it.
 */
export function hasProject(root: string): boolean {
  return fs.existsSync(vibePath(root));
}

/** Seed `.vibe/` when it is missing. Returns what was created; an existing project is left alone. */
export function ensureProject(root: string): string[] {
  const fresh = !hasProject(root);
  const created: string[] = [];
  for (const dir of ['', 'evidence', 'knowledge', 'knowledge/research', 'regressions']) {
    const target = vibePath(root, dir);
    if (!fs.existsSync(target)) {
      ensureDir(target);
      created.push(path.relative(root, target));
    }
  }
  const seeds: Array<[string, string]> = [
    ['intent.md', ''],
    ['scenarios.yaml', '[]\n'],
    ['results.json', '{}\n'],
  ];
  for (const [name, body] of seeds) {
    const target = vibePath(root, name);
    if (!fs.existsSync(target)) {
      writeAtomic(target, body);
      created.push(path.relative(root, target));
    }
  }
  if (!fs.existsSync(statePath(root))) writeJson(statePath(root), emptyState());
  if (fresh) record(root, { event: 'init', client: detectClient(), model: detectModel() });
  return created;
}

export interface ProjectStatus {
  root: string;
  vibe: boolean;
  state: string;
  inboxOpen: number;
}

export function projectStatus(root: string): ProjectStatus {
  const vibe = hasProject(root);
  return { root, vibe, state: vibe ? readState(root).state : 'NONE', inboxOpen: vibe ? openQuestions(root).length : 0 };
}

/** Delete `.vibe/` — the project's whole record. Only `vibe uninstall --purge-state` calls this. */
export function purgeProject(root: string): boolean {
  if (!hasProject(root)) return false;
  fs.rmSync(vibePath(root), { recursive: true, force: true });
  return true;
}
