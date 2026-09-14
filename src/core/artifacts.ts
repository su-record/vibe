import { artifactPathsValid } from './artifact-paths.js';
import fs from 'node:fs';
import path from 'node:path';
import { boundedFile, hashBytes } from './inspect.js';

export type ArtifactProof = Record<string, { bytes: number; sha256: string }>;
const MAX_FILE = 16 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;

/** Opt-in output evidence, including files ignored by Git. Never executes a check. */
export function captureArtifacts(root: string, files?: string[]): ArtifactProof | undefined {
  if (!files) return undefined;
  if (!artifactPathsValid(files)) throw new Error('invalid artifact paths');
  const proof: ArtifactProof = Object.create(null);
  let total = 0;
  for (const file of files) {
    const target = path.resolve(fs.realpathSync(root), file);
    const size = fs.lstatSync(target).size;
    total += size;
    if (size > MAX_FILE || total > MAX_TOTAL) throw new Error('artifact byte limit');
    const bytes = boundedFile(target, size);
    if (bytes.length !== size) throw new Error('artifact changed during inspection');
    proof[file] = { bytes: bytes.length, sha256: hashBytes(bytes) };
  }
  return proof;
}

export function artifactsFresh(root: string, proof?: ArtifactProof): boolean {
  if (proof === undefined) return true;
  try {
    const current = captureArtifacts(root, Object.keys(proof))!;
    return Object.keys(proof).every(file => current[file]?.bytes === proof[file]?.bytes
      && current[file]?.sha256 === proof[file]?.sha256);
  } catch { return false; }
}
