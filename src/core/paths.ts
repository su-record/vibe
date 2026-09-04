import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIBE_DIR = '.vibe';
/** A `.vibe/` counts as a project only when it holds a record — an empty directory does not. */
const RECORDS = ['state.json', 'intent.md', 'scenarios.yaml', 'ledger.jsonl', 'config.json'];

export function isProjectDir(dir: string): boolean {
  return RECORDS.some((f) => fs.existsSync(path.join(dir, VIBE_DIR, f)));
}

/**
 * Nearest ancestor whose `.vibe/` holds a record, searching no further than the first directory
 * that contains `.git` (a repository boundary) and never past the home directory. The home itself
 * is a root only when the search starts there. With no match the start directory is returned, so
 * the first record creates `./.vibe` right where the user is.
 */
export function findProjectRoot(start: string = process.cwd(), home: string = os.homedir()): string {
  const origin = path.resolve(start);
  const homeDir = path.resolve(home);
  let dir = origin;
  for (;;) {
    if (dir === homeDir && origin !== homeDir) break;
    if (isProjectDir(dir)) return dir;
    if (fs.existsSync(path.join(dir, '.git'))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return origin;
}

export function vibePath(root: string, ...parts: string[]): string {
  return path.join(root, VIBE_DIR, ...parts);
}

export function hasVibe(root: string): boolean {
  return fs.existsSync(vibePath(root));
}

/** Package root — the same place whether running from dist/ or src/. */
export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/core or src/core → two levels up
  return path.resolve(here, '..', '..');
}
