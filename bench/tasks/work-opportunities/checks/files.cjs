const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function inside(root, name) {
  const file = path.resolve(root, name);
  const relative = path.relative(path.resolve(root), file);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`path must name a file inside the supplied directory: ${name}`);
  return file;
}

function files(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic links are not fixture inputs: ${name}`);
    return entry.isDirectory() ? files(root, name) : [name];
  }).sort();
}

function manifest(root) {
  return Object.fromEntries(files(root).map((name) => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')]));
}

function environment(home, sink) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|PATHEXT|COMSPEC|SYSTEMROOT|WINDIR|LANG|LC_ALL)$/i.test(name)));
  return { ...env, HOME: home, USERPROFILE: home, TMP: home, TEMP: home, TMPDIR: home, VIBE_EFFECT_SINK: sink, VIBE_SKIP_SETUP: '1' };
}

function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }

module.exports = { inside, files, manifest, environment, json, writeJson };
