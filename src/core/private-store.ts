import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { denied } from './errors.js';

export function inside(parent: string, file: string): boolean {
  const relative = path.relative(parent, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Reject inherited links; Windows privacy relies on the current user's profile ACL. */
function privateStat(file: string, directory: boolean): fs.Stats {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (!directory && stat.nlink !== 1)) throw denied('local store entry must be a real private directory or regular file, never linked');
  if (process.platform !== 'win32' && (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)) throw denied('local store permissions must be owner-private (0700 directory, 0600 file)');
  return stat;
}

export function privateDirectory(root: string, create: boolean): string {
  const home = fs.realpathSync(os.homedir());
  const dir = path.join(home, '.vibe-runtime');
  if (inside(fs.realpathSync(root), dir)) throw denied('local execution consent storage must be outside the project');
  if (!fs.existsSync(dir) && !fs.lstatSync(dir, { throwIfNoEntry: false })) {
    if (!create) return dir;
    fs.mkdirSync(dir, { mode: 0o700 });
  }
  privateStat(dir, true);
  return dir;
}

/** O_NOFOLLOW plus descriptor identity checks narrow races; this does not isolate same-user processes. */
export function readPrivate(root: string, name: string, maxBytes = 2_097_152): string | null {
  const dir = privateDirectory(root, false);
  if (!fs.existsSync(dir)) return null;
  const file = path.join(dir, name);
  if (!fs.lstatSync(file, { throwIfNoEntry: false })) return null;
  const before = privateStat(file, false);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const actual = fs.fstatSync(fd);
    if (actual.dev !== before.dev || actual.ino !== before.ino || actual.size > maxBytes) throw denied('local store entry changed or exceeds its read limit');
    const buffer = Buffer.alloc(maxBytes + 1);
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const after = privateStat(file, false);
    if (length > maxBytes || after.ino !== actual.ino || after.dev !== actual.dev || after.mtimeMs !== actual.mtimeMs) throw denied('local store entry changed or exceeds its read limit');
    return buffer.subarray(0, length).toString('utf8');
  } finally { fs.closeSync(fd); }
}

export function writePrivate(root: string, name: string, text: string): string {
  if (!/^[a-z0-9.-]+$/i.test(name)) throw denied('invalid local store entry name');
  const dir = privateDirectory(root, true);
  const file = path.join(dir, name);
  if (fs.lstatSync(file, { throwIfNoEntry: false })) privateStat(file, false);
  const temporary = path.join(dir, `${name}.${randomBytes(12).toString('hex')}.tmp`);
  fs.writeFileSync(temporary, text, { flag: 'wx', mode: 0o600 });
  try { privateStat(dir, true); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return file;
}
