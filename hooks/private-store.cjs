const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

function inside(parent, file) {
  const relative = path.relative(parent, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function privateEntry(stat, directory) {
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) || (!directory && stat.nlink !== 1)) throw new Error('local store entry must be a real private directory or regular file, never linked');
  if (process.platform !== 'win32' && (stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)) throw new Error('local store permissions must be owner-private (0700 directory, 0600 file)');
  return stat;
}
function privateStat(file, directory) { return privateEntry(fs.lstatSync(file), directory); }
function privateDirectory(root, create, homeDirectory = os.homedir()) {
  const home = fs.realpathSync(homeDirectory);
  const dir = path.join(home, '.vibe-runtime');
  if (inside(fs.realpathSync(root), dir)) throw new Error('local execution consent storage must be outside the project');
  if (!fs.lstatSync(dir, { throwIfNoEntry: false })) {
    if (!create) return dir;
    fs.mkdirSync(dir, { mode: 0o700 });
  }
  privateStat(dir, true);
  return dir;
}
function entryName(name) {
  if (!/^[a-z0-9.-]+$/i.test(name)) throw new Error('invalid local store entry name');
}
function readPrivate(root, name, maxBytes = 2097152, homeDirectory) {
  entryName(name);
  const dir = privateDirectory(root, false, homeDirectory);
  if (!fs.existsSync(dir)) return null;
  const file = path.join(dir, name);
  if (!fs.lstatSync(file, { throwIfNoEntry: false })) return null;
  const before = privateStat(file, false);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const actual = privateEntry(fs.fstatSync(fd), false);
    if (actual.dev !== before.dev || actual.ino !== before.ino || actual.size > maxBytes) throw new Error('local store entry changed or exceeds its read limit');
    const buffer = Buffer.alloc(maxBytes + 1);
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const after = privateStat(file, false);
    if (length > maxBytes || length !== actual.size || after.ino !== actual.ino || after.dev !== actual.dev || after.size !== actual.size || after.mtimeMs !== actual.mtimeMs || after.ctimeMs !== actual.ctimeMs) throw new Error('local store entry changed or exceeds its read limit');
    return buffer.subarray(0, length).toString('utf8');
  } finally { fs.closeSync(fd); }
}
function writePrivate(root, name, text, homeDirectory) {
  entryName(name);
  const dir = privateDirectory(root, true, homeDirectory);
  const file = path.join(dir, name);
  if (fs.lstatSync(file, { throwIfNoEntry: false })) privateStat(file, false);
  const temporary = path.join(dir, `${name}.${randomBytes(12).toString('hex')}.tmp`);
  fs.writeFileSync(temporary, text, { flag: 'wx', mode: 0o600 });
  try { privateStat(dir, true); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return file;
}
module.exports = { inside, privateDirectory, readPrivate, writePrivate };
