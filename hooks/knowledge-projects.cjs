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

const MAX_LISTED = 200;
const START = '<!-- vibe:shared-knowledge -->';
const END = '<!-- /vibe:shared-knowledge -->';

/** The shared folder's pages by subfolder, without links or dot folders; names that cannot be a [[link]] are left out. */
function sharedPages(folder) {
  const groups = new Map();
  let count = 0;
  const walk = relative => {
    for (const entry of fs.readdirSync(path.join(folder, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name);
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile() && entry.name.endsWith('.md') && !/[[\]|#^]/.test(name) && ++count <= MAX_LISTED) {
        groups.set(relative, [...(groups.get(relative) ?? []), name.replace(/\.md$/, '')]);
      }
    }
  };
  walk('');
  return { groups, more: Math.max(0, count - MAX_LISTED) };
}

function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, text);
  fs.renameSync(temporary, file);
}

/**
 * Keep every shared page reachable from the wiki's index: a block in `projects/<name>.md` that vibe rewrites
 * at each session start, one line per subfolder, and the project page's line in `index.md` when it is missing.
 * Everything outside the block, and every other line of the index, is the model's and the person's.
 */
function indexProject(root, wiki, name) {
  const { groups, more } = sharedPages(path.join(root, '.vibe', 'knowledge'));
  const lines = [...groups].map(([folder, pages]) => `- ${folder || 'pages'}: ${pages.map(p => `[[projects/${name}/${p}]]`).join(' · ')}`);
  const block = [START, `Shared knowledge of this project (\`.vibe/knowledge\`), listed by vibe at each session start; edit outside this block.`,
    ...(lines.length ? lines : ['- none yet']), ...(more ? [`- and ${more} more pages`] : []), END].join('\n');
  const page = path.join(wiki, 'projects', `${name}.md`);
  const current = fs.existsSync(page) ? fs.readFileSync(page, 'utf8') : `# ${name}\n`;
  const at = current.indexOf(START), end = current.indexOf(END, at);
  writeIfChanged(page, at >= 0 && end > at ? `${current.slice(0, at)}${block}${current.slice(end + END.length)}` : `${current.trimEnd()}\n\n${block}\n`);
  const index = path.join(wiki, 'index.md');
  const listed = fs.existsSync(index) ? fs.readFileSync(index, 'utf8') : '# Index\n';
  if (!new RegExp(`\\[\\[projects/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.md)?[\\]|#]`).test(listed)) {
    writeIfChanged(index, `${listed.trimEnd()}\n- [[projects/${name}]] — this project's page and its shared knowledge\n`);
  }
}

module.exports = { projectName, linkProject, indexProject };
