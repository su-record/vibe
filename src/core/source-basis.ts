import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { denied, usage } from './errors.js';
import { vibePath } from './paths.js';
import { writeJson } from './store.js';

export interface SourceReference {
  path: string;
  sha256: string;
}

interface SourceStatus extends SourceReference {
  status: 'unchanged' | 'changed' | 'missing' | 'unreadable';
  currentSha256: string | null;
}

export interface SourceValidity {
  sources: SourceStatus[];
  valid: boolean;
  changed: string[];
  missing: string[];
  unreadable: string[];
}

function relativeInput(root: string, file: string): string {
  const relative = path.relative(path.resolve(root), path.resolve(root, file));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw usage(`source must be a regular file inside the project: ${file}`);
  if (['.vibe', '.git'].includes(relative.split(path.sep)[0] ?? '')) throw usage(`source must be an input file, not project bookkeeping: ${file}`);
  return relative.split(path.sep).join('/');
}

function sourceHash(root: string, file: string): string {
  const relative = relativeInput(root, file);
  const absolute = path.resolve(root, relative);
  relativeInput(fs.realpathSync(root), fs.realpathSync(absolute));
  if (!fs.statSync(absolute).isFile()) throw usage(`source must be a regular file, not a directory or device: ${file}`);
  return createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
}

export function captureSources(root: string, sources?: string[]): SourceReference[] {
  if (sources === undefined) return [];
  if (!Array.isArray(sources) || sources.some((file) => typeof file !== 'string' || !file.trim())) throw usage('sources must be an array of nonempty file paths');
  const paths = [...new Set(sources.map((file) => relativeInput(root, file)))].sort();
  return paths.map((file) => {
    try { return { path: file, sha256: sourceHash(root, file) }; }
    catch (error) { throw usage(`cannot record source ${file}: ${(error as Error).message}`); }
  });
}

export function readSourceBasis(root: string): SourceReference[] {
  const file = vibePath(root, 'source-basis.json');
  if (!fs.existsSync(file)) return [];
  try {
    const value: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(value) || value.some((entry) => !entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256))) throw new Error('invalid source record');
    return value as SourceReference[];
  } catch { throw denied('source basis is invalid — re-evaluate the inputs and run `intent draft` again'); }
}

export function saveSourceBasis(root: string, sources: SourceReference[]): void {
  const file = vibePath(root, 'source-basis.json');
  if (sources.length) writeJson(file, sources);
  else fs.rmSync(file, { force: true });
}

export function sourceValidity(root: string, basis = readSourceBasis(root)): SourceValidity | null {
  if (!basis.length) return null;
  const sources = basis.map((source): SourceStatus => {
    try {
      const currentSha256 = sourceHash(root, source.path);
      return { ...source, currentSha256, status: currentSha256 === source.sha256 ? 'unchanged' : 'changed' };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return { ...source, currentSha256: null, status: code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'unreadable' };
    }
  });
  const paths = (status: SourceStatus['status']) => sources.filter((source) => source.status === status).map((source) => source.path);
  return { sources, valid: sources.every((source) => source.status === 'unchanged'), changed: paths('changed'), missing: paths('missing'), unreadable: paths('unreadable') };
}
