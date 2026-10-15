// Obsidian's vault registry, read and extended without Obsidian or any dependency, so the session hook and
// the CLI connect the knowledge wiki the same way.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Where Obsidian keeps its vault list on each platform, including the Flatpak build on Linux. */
function obsidianRegistries(home, platform = process.platform, env = process.env) {
  if (platform === 'darwin') return [path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json')];
  if (platform === 'win32') return [path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'obsidian', 'obsidian.json')];
  return [path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'obsidian', 'obsidian.json'),
    path.join(home, '.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian', 'obsidian.json')];
}

/** Registered vaults that still exist, by real path: the open one first, then the most recently used. */
function obsidianVaults(home, platform, env) {
  const found = new Map();
  for (const file of obsidianRegistries(home, platform, env)) {
    for (const v of Object.values(readJson(file)?.vaults ?? {})) {
      if (typeof v?.path !== 'string' || !path.isAbsolute(v.path) || !fs.statSync(v.path, { throwIfNoEntry: false })?.isDirectory()) continue;
      const real = fs.realpathSync(v.path);
      found.set(real, { path: real, open: v.open === true, ts: typeof v.ts === 'number' ? v.ts : 0 });
    }
  }
  return [...found.values()].sort((a, b) => Number(b.open) - Number(a.open) || b.ts - a.ts);
}

const CLOUD = [['Mobile Documents', 'iCloud'], ['iCloud', 'iCloud'], ['Dropbox', 'Dropbox'], ['OneDrive', 'OneDrive'], ['Google Drive', 'Google Drive'], ['CloudStorage', 'a cloud drive']];

/** The service that copies this folder off the computer, when its path or Obsidian's own Sync plugin shows one. */
function syncedBy(folder) {
  const parts = folder.split(/[\\/]/);
  const cloud = CLOUD.find(([marker]) => parts.some(part => part.includes(marker)));
  if (cloud) return cloud[1];
  for (let dir = folder; ; dir = path.dirname(dir)) {
    const plugins = readJson(path.join(dir, '.obsidian', 'core-plugins.json'));
    if (plugins !== null) return (Array.isArray(plugins) ? plugins.includes('sync') : plugins?.sync === true) ? 'Obsidian Sync' : null;
    if (path.dirname(dir) === dir) return null;
  }
}

/** A path with every existing part resolved, so a linked vault is stored by the folder the brief can read. */
function realFolder(folder) {
  const rest = [];
  let dir = path.resolve(folder);
  while (!fs.existsSync(dir) && path.dirname(dir) !== dir) { rest.unshift(path.basename(dir)); dir = path.dirname(dir); }
  return path.join(fs.realpathSync(dir), ...rest);
}

/** Copy an earlier wiki into a new, empty location; nothing is overwritten, followed through a link or deleted. */
function carryWiki(from, to) {
  if (path.resolve(from) === path.resolve(to) || !fs.existsSync(from)) return 0;
  if (fs.existsSync(to) && fs.readdirSync(to).length) return 0;
  let count = 0;
  fs.cpSync(from, to, { recursive: true, force: false, errorOnExist: false, filter: source => {
    const stat = fs.lstatSync(source);
    if (stat.isFile()) count++;
    return !stat.isSymbolicLink();
  } });
  return count;
}

/**
 * Make the wiki a vault and list it where Obsidian lists vaults. The registry exists only once Obsidian has run,
 * so before that the folder waits as a vault; every session start repeats this, and the first one after Obsidian
 * appears connects it. A folder already inside a registered vault belongs to that vault.
 */
function connectVault(folder, home, platform, env) {
  fs.mkdirSync(path.join(folder, '.obsidian'), { recursive: true });
  const registry = obsidianRegistries(home, platform, env).find(file => fs.existsSync(file));
  const doc = registry ? readJson(registry) : null;
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'waiting';
  const real = fs.realpathSync(folder);
  if (obsidianVaults(home, platform, env).some(v => real === v.path || real.startsWith(`${v.path}${path.sep}`))) return 'in-vault';
  const id = createHash('sha256').update(real).digest('hex').slice(0, 16);
  const next = { ...doc, vaults: { ...(doc.vaults ?? {}), [id]: { path: real, ts: Date.now() } } };
  const temporary = `${registry}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next));
  fs.renameSync(temporary, registry);
  return 'connected';
}

module.exports = { obsidianRegistries, obsidianVaults, syncedBy, realFolder, carryWiki, connectVault };
