import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.vibe', 'dist', '.claude', '.codex']);

function git(root: string, args: string[]): string | null {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout : null;
}

function walk(dir: string, rel: string, into: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), `${rel}${entry.name}/`, into);
    } else if (entry.isFile()) {
      const stat = fs.statSync(path.join(dir, entry.name));
      into.push(`${rel}${entry.name}:${stat.size}:${Math.floor(stat.mtimeMs)}`);
    }
  }
}

/**
 * Working-tree fingerprint. DONE must be void the moment something is edited, so the code
 * looks at what changed: HEAD plus changed/untracked file contents in a git repo, otherwise
 * path·size·mtime of every file.
 */
export function treeHash(root: string): string {
  const hash = createHash('sha256');
  const head = git(root, ['rev-parse', 'HEAD']);
  if (head !== null) {
    hash.update(head);
    const changed = git(root, ['status', '--porcelain', '--untracked-files=all']) ?? '';
    for (const line of changed.split('\n')) {
      const file = line.slice(3).trim();
      if (!file || file.startsWith('.vibe/')) continue;
      hash.update(line);
      try {
        hash.update(fs.readFileSync(path.join(root, file)));
      } catch {
        hash.update('(missing)');
      }
    }
    return hash.digest('hex').slice(0, 16);
  }
  const entries: string[] = [];
  walk(root, '', entries);
  entries.sort();
  for (const entry of entries) hash.update(entry);
  return hash.digest('hex').slice(0, 16);
}
