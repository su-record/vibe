import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIBE_DIR = '.vibe';

/** Nearest ancestor that contains `.vibe/`; falls back to the start directory. */
export function findProjectRoot(start: string = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, VIBE_DIR))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
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
