import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIBE_DIR = '.vibe';

/** `.vibe/` 를 가진 가장 가까운 상위 디렉토리. 없으면 시작 디렉토리. */
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

/** 패키지 루트 — dist/ 나 src/ 어디서 실행돼도 같은 곳. */
export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/core 또는 src/core → 두 단계 위
  return path.resolve(here, '..', '..');
}
