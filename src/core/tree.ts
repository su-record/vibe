import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.vibe', 'dist', '.claude', '.codex']);

function git(root: string, args: string[]): string | null {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
  return result.status === 0 ? result.stdout : null;
}

/** The id git would give this content — `sha1("blob <size>\\0" + bytes)`. */
function blobId(content: Buffer): string {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
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

/** Changed or untracked files relative to HEAD with their content ids (`deleted` when gone), `.vibe/` excluded. Empty outside git. */
export function changedBlobs(root: string, limit = 200): Record<string, string> {
  const changed = git(root, ['status', '--porcelain', '--untracked-files=all']);
  const out: Record<string, string> = {};
  if (changed === null) return out;
  let n = 0;
  for (const line of changed.split('\n')) {
    const file = line.slice(3).trim();
    if (!file || file.startsWith('.vibe/')) continue;
    try {
      out[file] = blobId(fs.readFileSync(path.join(root, file)));
    } catch {
      out[file] = 'deleted';
    }
    n += 1;
    if (n >= limit) break;
  }
  return out;
}

/** Files whose content differs from a previous snapshot — new, edited or deleted since then. */
export function changedSince(previous: Record<string, string> | null, current: Record<string, string>): string[] {
  if (previous === null) return Object.keys(current);
  return Object.keys(current).filter((file) => previous[file] !== current[file]);
}

/**
 * Working-tree fingerprint. DONE must be void the moment something is edited, so the code
 * looks at content: tracked blob ids plus changed/untracked file contents in a git repo, otherwise
 * path·size·mtime of every file.
 */
export function treeHash(root: string): string {
  const hash = createHash('sha256');
  const tracked = git(root, ['ls-tree', '-r', 'HEAD']);
  if (tracked !== null) {
    // path → blob id, for tracked and working-tree files alike, so committing the same content
    // gives the same hash. `.vibe/` is excluded because state.json changes on every check.
    const blobs = new Map<string, string>();
    for (const line of tracked.split('\n')) {
      const [meta, file] = line.split('\t');
      const id = meta?.split(' ')[2];
      if (file && id && !file.startsWith('.vibe/')) blobs.set(file, id);
    }
    const changed = git(root, ['status', '--porcelain', '--untracked-files=all']) ?? '';
    for (const line of changed.split('\n')) {
      const file = line.slice(3).trim();
      if (!file || file.startsWith('.vibe/')) continue;
      try {
        blobs.set(file, blobId(fs.readFileSync(path.join(root, file))));
      } catch {
        blobs.delete(file);
      }
    }
    for (const [file, id] of [...blobs.entries()].sort()) hash.update(`${file}:${id}\n`);
    return hash.digest('hex').slice(0, 16);
  }
  const entries: string[] = [];
  walk(root, '', entries);
  entries.sort();
  for (const entry of entries) hash.update(entry);
  return hash.digest('hex').slice(0, 16);
}
