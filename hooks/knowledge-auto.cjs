// Session knowledge, off unless the person runs `vibe knowledge auto on`. When on, the hook gives the
// working model a knowledge turn after a turn that changed project files, or after a few conversation turns
// without one, and appends a fact line to the wiki's log.md. The model, which already holds the
// conversation, decides what to keep. With the journal on (the default while session knowledge is on), the prompt and
// shell hooks append to a private journal the knowledge turn reads instead of relying on memory. The hook reads no
// transcript, starts no model and resolves no PATH command.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inside, readPrivate, writePrivate } = require('./private-store.cjs');
const { optional, digest, revision, projectFingerprint } = require('./session-files.cjs');
const { identity, hostRoot } = require('./session-state.cjs');
const { connectVault } = require('./obsidian.cjs');
const { projectName, linkProject, indexProject } = require('./knowledge-projects.cjs');
const journal = require('./knowledge-journal.cjs');

const defaultHome = () => process.env.VIBE_HOME_DIR || os.homedir();
const entry = (root, id) => `knowledge-${digest(`${root}\0${id}`)}.json`;

/** The same file and defaults `vibe knowledge auto` writes (src/core/knowledge.ts). */
function settings(home) {
  try {
    const raw = JSON.parse(optional(path.join(home, '.config', 'vibe', 'knowledge.json'), 65536) ?? '{}');
    return {
      auto: raw.auto === true,
      dir: typeof raw.dir === 'string' && path.isAbsolute(raw.dir) ? raw.dir : path.join(home, '.config', 'vibe', 'knowledge'),
      turns: Number.isInteger(raw.turns) && raw.turns >= 0 ? raw.turns : 5,
      skills: raw.skills === 'create' ? 'create' : 'propose',
      exclude: Array.isArray(raw.exclude) ? raw.exclude.filter(e => typeof e === 'string' && path.isAbsolute(e)) : [],
      journal: raw.journal !== false,
    };
  } catch { return { auto: false }; }
}

// The home directory is not a project: hashing it would cost every turn and say nothing about one piece of work.
// An excluded folder is never fingerprinted, logged, journaled or handed a knowledge turn.
function place(payload, home, exclude) {
  const root = hostRoot(payload);
  if (root === fs.realpathSync(home)) throw new Error('home is not a project');
  const real = folder => (fs.existsSync(folder) ? fs.realpathSync(folder) : path.resolve(folder));
  if (exclude.some(folder => inside(real(folder), root))) throw new Error('excluded by the person');
  return { root, id: identity(payload) };
}
function snapshot(payload, home, exclude) {
  const at = place(payload, home, exclude);
  return { ...at, files: projectFingerprint(at.root) };
}

/** UserPromptSubmit and PostToolUse(Bash): one journal line, silently; nothing when knowledge or the journal is off. */
function observe(kind, payload, home = defaultHome()) {
  const { auto, exclude, journal: on } = settings(home);
  if (!auto || !on) return;
  try {
    const at = place(payload, home, exclude);
    const line = journal.entryFor(kind, payload, at.id);
    if (line) journal.append(at.root, line, home);
  } catch { /* the work goes on without a journal line */ }
}

function client(env = process.env) {
  if (env.VIBE_CLIENT) return ['codex', 'chatgpt'].includes(env.VIBE_CLIENT) ? 'codex' : 'claude';
  return env.CODEX_THREAD_ID && !env.CLAUDE_SESSION_ID ? 'codex' : 'claude';
}

function logLine(root, what, project, now = new Date()) {
  let at = 'unversioned';
  try { at = revision(root).slice(0, 12); } catch { /* the line still records the turn */ }
  return `- ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC · [[projects/${project}]] · ${client()} · ${at} · ${what}\n`;
}

function remembered(root, id, home) {
  try {
    const raw = JSON.parse(readPrivate(root, entry(root, id), 4096, home) ?? 'null');
    return raw && typeof raw.files === 'string' && Number.isInteger(raw.turns) ? raw : null;
  } catch { return null; }
}

const RECALL = '[vibe] Session knowledge is on: before choosing an approach, a tool or a design, run `vibe knowledge find <subject>` and follow the recorded decisions, reuse the methods and avoid the recorded problems; say when a choice departs from one.';

/** SessionStart: remember the project's files so the first turn's changes are seen; the recall line when on. */
function start(payload, home = defaultHome()) {
  const { auto, dir, exclude } = settings(home);
  if (!auto) return null;
  try { connectVault(dir, home); } catch { /* Obsidian's list stays as it was; the wiki still works */ }
  try {
    const now = snapshot(payload, home, exclude);
    writePrivate(now.root, entry(now.root, now.id), JSON.stringify({ files: now.files, turns: 0 }), home);
    const name = projectName(now.root, home);
    if (linkProject(now.root, dir, name) === 'linked') indexProject(now.root, dir, name);
  } catch { /* no record this session */ }
  return RECALL;
}

const SKILLS = {
  propose: 'draft a skill for a repeated procedure and offer it in one line without installing it',
  create: 'create a skill for a repeated procedure (the user allowed it) and report it',
};
// Knowledge the project's team needs goes into the project, which travels with it; the rest stays personal.
const PLACES = (dir, root, name) => {
  const shared = fs.statSync(path.join(root, '.vibe'), { throwIfNoEntry: false })?.isDirectory()
    ? `; what the project's team needs (its code, conventions, domain facts) goes into ${path.join(root, '.vibe', 'knowledge')}, which the wiki shows as projects/${name}/` : '';
  return `in the wiki at ${dir} (this project's page is projects/${name}.md)${shared}`;
};
const REASON = (places, skills, observed) => `[vibe] Knowledge turn: the user turned on session knowledge; this is not a user message. Follow \`vibe internal guide wiki\` (load it if absent): keep what is durable from the turns since the last knowledge turn ${places}${observed}, record a better method when one showed, ${SKILLS[skills]}, propose at most one improvement fitted to how the user works (a skill, rule, prompt, script or tool, check or hook) when the record shows a repeat, and tell the user in one line what you recorded, added or propose. If nothing qualifies, end the turn with no output.`;

/** Stop: after a changed turn, or `turns` conversation turns, log the fact and give the model one knowledge turn. */
function stop(payload, home = defaultHome()) {
  const { auto, dir, turns: every, skills, exclude, journal: on } = settings(home);
  if (!auto || payload.stop_hook_active === true) return {};
  try {
    const now = snapshot(payload, home, exclude);
    const before = remembered(now.root, now.id, home);
    const changed = before !== null && before.files !== now.files;
    const turns = (before?.turns ?? 0) + 1;
    if (before === null || (!changed && (every === 0 || turns < every))) {
      writePrivate(now.root, entry(now.root, now.id), JSON.stringify({ files: now.files, turns: before === null ? 0 : turns }), home);
      return {};
    }
    fs.mkdirSync(dir, { recursive: true });
    const name = projectName(now.root, home);
    fs.appendFileSync(path.join(dir, 'log.md'), logLine(now.root, changed ? 'files changed' : 'conversation', name));
    // A wiki inside the project changes the files it was just compared with; look again so that is not seen as work.
    const files = inside(now.root, dir) ? projectFingerprint(now.root) : now.files;
    writePrivate(now.root, entry(now.root, now.id), JSON.stringify({ files, turns: 0 }), home);
    return { decision: 'block', reason: REASON(PLACES(dir, now.root, name), skills, on ? observed(now, home) : '') };
  } catch { return {}; }
}

/** Mark the knowledge turn in the journal and say what it holds for this turn. */
function observed(now, home) {
  try {
    const summary = journal.summarize(journal.read(now.root, home));
    journal.append(now.root, journal.entryFor('turn', {}, now.id), home);
    return journal.brief(summary);
  } catch { return ''; }
}

module.exports = { settings, logLine, start, stop, observe };
