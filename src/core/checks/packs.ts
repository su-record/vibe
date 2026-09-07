import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../paths.js';

/**
 * Reviewer packs — a pack is a medium, not only a language. `reviewers/<pack>/` holds its stages
 * as `N-<stage>.md`, and the `review` check runs them in numeric order. Stage names are data:
 * the text packs run a copy editor then a chief editor, the design pack a markup reviewer then an
 * art director, and a pack added later needs no code change.
 */
export interface Stage {
  order: number;
  name: string;
  file: string;
}

const STAGE_FILE = /^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

export function reviewersDir(pack: string, root: string = packageRoot()): string {
  return path.join(root, 'reviewers', pack);
}

/** The stages of a pack, in numeric order; an empty list means the pack is not in this package. */
export function packStages(pack: string, root: string = packageRoot()): Stage[] {
  const dir = reviewersDir(pack, root);
  if (!fs.existsSync(dir)) return [];
  const stages: Stage[] = [];
  for (const name of fs.readdirSync(dir)) {
    const m = STAGE_FILE.exec(name);
    if (m) stages.push({ order: Number(m[1]), name: m[2] as string, file: path.join(dir, name) });
  }
  return stages.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function listPacks(root: string = packageRoot()): string[] {
  const dir = path.join(root, 'reviewers');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()).sort() : [];
}

/** Text packs are the ones a manuscript's language can select; every other pack is named by `pack`. */
export const TEXT_PACKS = ['ko', 'en'] as const;
