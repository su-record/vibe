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
 * 작업 트리 지문 — DONE 은 편집 즉시 무효여야 하므로 "무엇이 바뀌었나" 를 코드가 본다.
 * git 저장소면 HEAD + 변경·미추적 파일 내용, 아니면 경로·크기·mtime.
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
