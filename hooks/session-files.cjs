const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const digest = value => createHash('sha256').update(value).digest('hex');
function bounded(file, max = 1048576) {
  const full = path.resolve(file);
  let cursor = path.parse(full).root;
  for (const component of full.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('linked input');
  }
  const original = fs.lstatSync(full);
  const fd = fs.openSync(full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size > max || before.dev !== original.dev || before.ino !== original.ino) throw new Error('input limit');
    const bytes = Buffer.alloc(max + 1);
    const count = fs.readSync(fd, bytes, 0, bytes.length, 0);
    const after = fs.lstatSync(full);
    if (!after.isFile() || count > max || count !== before.size || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('input changed');
    return bytes.subarray(0, count);
  } finally { fs.closeSync(fd); }
}
function optional(file, max) {
  if (!fs.lstatSync(file, { throwIfNoEntry: false })) return null;
  return bounded(file, max).toString('utf8');
}
function json(file, fallback = {}) {
  const text = optional(file);
  return text === null ? fallback : JSON.parse(text);
}
function revision(root) {
  const git = path.join(root, '.git');
  const stat = fs.lstatSync(git, { throwIfNoEntry: false });
  if (!stat) return 'unversioned';
  if (stat.isSymbolicLink()) throw new Error('linked git metadata');
  const dir = stat.isDirectory() ? git : path.resolve(root, /^gitdir: (.+)\s*$/.exec(bounded(git, 4096).toString('utf8'))?.[1] ?? 'invalid-gitdir');
  const head = bounded(path.join(dir, 'HEAD'), 4096).toString('utf8').trim();
  if (/^[a-f0-9]{40,64}$/.test(head)) return head;
  const ref = /^ref: (refs\/[a-zA-Z0-9._/-]+)$/.exec(head)?.[1];
  if (!ref || ref.split('/').includes('..')) throw new Error('invalid git reference');
  const common = optional(path.join(dir, 'commondir'), 4096);
  const base = common === null ? dir : path.resolve(dir, common.trim());
  const direct = optional(path.join(base, ref), 4096)?.trim();
  if (direct && /^[a-f0-9]{40,64}$/.test(direct)) return direct;
  const packed = optional(path.join(base, 'packed-refs')) ?? '';
  const found = packed.split('\n').find(line => line.endsWith(` ${ref}`))?.split(' ')[0];
  return found && /^[a-f0-9]{40,64}$/.test(found) ? found : 'unborn';
}
function projectFingerprint(root) {
  const hash = createHash('sha256');
  const queue = [''];
  let count = 0, bytes = 0;
  const deadline = Date.now() + 1500;
  while (queue.length) {
    const relative = queue.shift();
    const entries = fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++count > 10000 || Date.now() > deadline) throw new Error('project status limit');
      if (['.git', 'node_modules', '.claude', '.codex', '.agents'].includes(entry.name)) continue;
      const name = path.posix.join(relative, entry.name);
      if (name.startsWith('.vibe/') && !/^\.vibe\/(?:intent\.md|scenarios\.yaml|source-basis\.json|config\.json|regressions(?:\/.*)?)$/.test(name)) continue;
      if (entry.isDirectory()) { queue.push(name); continue; }
      if (!entry.isFile()) throw new Error('nonregular project input');
      const content = bounded(path.join(root, name), 8388608);
      bytes += content.length;
      if (bytes > 67108864) throw new Error('project byte limit');
      hash.update(name).update('\0').update(digest(content)).update('\n');
    }
  }
  return hash.digest('hex');
}
function readPayload() {
  const bytes = Buffer.alloc(65537);
  let length = 0, read;
  do { read = fs.readSync(0, bytes, length, bytes.length - length, null); length += read; } while (read && length < bytes.length);
  if (length > 65536) throw new Error('hook payload limit');
  return length ? JSON.parse(bytes.subarray(0, length).toString('utf8')) : {};
}
module.exports = { bounded, optional, json, digest, revision, projectFingerprint, readPayload };
