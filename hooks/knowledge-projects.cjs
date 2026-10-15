// Each project's place in the knowledge wiki: one page name per project folder, and the project's shared
// knowledge shown inside the wiki. The session hook and the CLI both use this, so they name a project alike.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { inside } = require('./private-store.cjs');
const { syncedBy, realFolder } = require('./obsidian.cjs');

const namesFile = home => path.join(home, '.config', 'vibe', 'knowledge-projects.json');

function readNames(home) {
  try {
    const names = JSON.parse(fs.readFileSync(namesFile(home), 'utf8')).names;
    return names && typeof names === 'object' && !Array.isArray(names) ? names : {};
  } catch { return {}; }
}

/**
 * The project's page name: its folder name, or that name with a short mark when another folder already holds
 * it, so two projects called `app` never share `projects/app.md`. `record` keeps the choice for later sessions.
 */
function projectName(root, home, record = true) {
  const names = readNames(home);
  const owned = Object.keys(names).find(name => names[name] === root);
  if (owned) return owned;
  const base = path.basename(root).replace(/[[\]|#^\r\n]/g, '-') || 'project';
  const name = names[base] === undefined ? base : `${base}-${createHash('sha256').update(root).digest('hex').slice(0, 6)}`;
  if (record) {
    const file = namesFile(home);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ names: { ...names, [name]: root } }, null, 2));
    fs.renameSync(temporary, file);
  }
  return name;
}

function sameFolder(a, b) {
  try { return fs.realpathSync(a) === fs.realpathSync(b); } catch { return false; }
}

/**
 * Show a vibe project's shared knowledge (`.vibe/knowledge`, which travels with the project) in the wiki as
 * `projects/<name>/`. It is a link, so editing a page in Obsidian edits the project's file. Never into a synced
 * wiki, where the link could carry a client's knowledge off the computer, nor into a wiki inside the project.
 */
function linkProject(root, wiki, name) {
  if (!fs.statSync(path.join(root, '.vibe'), { throwIfNoEntry: false })?.isDirectory()) return 'none';
  if (syncedBy(wiki)) return 'synced';
  if (inside(root, realFolder(wiki))) return 'inside';
  const target = path.join(root, '.vibe', 'knowledge');
  fs.mkdirSync(target, { recursive: true });
  const link = path.join(wiki, 'projects', name);
  const existing = fs.lstatSync(link, { throwIfNoEntry: false });
  if (existing) return existing.isSymbolicLink() && sameFolder(link, target) ? 'linked' : 'taken';
  fs.mkdirSync(path.dirname(link), { recursive: true });
  // A junction on Windows needs no administrator or developer mode; elsewhere the type is ignored.
  fs.symlinkSync(target, link, 'junction');
  return 'linked';
}

module.exports = { projectName, linkProject };
