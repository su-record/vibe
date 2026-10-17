// The observation journal behind session knowledge: what the person asked, which shell commands ran and whether
// they worked, kept privately per project for 30 days. It lets the knowledge turn work from the record instead of
// the model's memory, and lets repeats show: an instruction given again and again, a command sequence run in
// several sessions, a command that keeps failing. No model reads it here; the hook only appends and counts.
const { readPrivate, writePrivate } = require('./private-store.cjs');
const { digest } = require('./session-files.cjs');

const DAY = 86400000;
const KEEP_DAYS = 30;
const MAX_ENTRIES = 2000;
const MAX_BYTES = 1048576;
const PROMPT_CHARS = 600;
const fileName = root => `journal-${digest(root).slice(0, 32)}.jsonl`;

// Secrets and other people's addresses never reach the journal: keys, tokens, private keys, `password=…`,
// JWTs, long opaque strings and e-mail addresses are masked before anything is written.
const SECRETS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, /\bgh[pousr]_[A-Za-z0-9]{20,}/g, /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g,
  /\b(?:password|passwd|pwd|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*\S+/gi,
  /[A-Za-z0-9+/_-]{40,}={0,2}/g, /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
];
const mask = text => SECRETS.reduce((value, pattern) => value.replace(pattern, '[masked]'), String(text));

// A prompt that pushes back on the last answer: the clearest sign of a missed expectation.
const CORRECTION = /^\s*(?:no\b|nope\b|wrong\b|not that\b|that'?s not\b|don'?t\b|stop\b|undo\b|again\b|아니|아냐|틀렸|그게 아니|다시|하지 ?마|그만|왜 )/i;
// Tools whose first word says little; their subcommand is the command's meaning.
const WITH_SUBCOMMAND = new Set(['git', 'npm', 'npx', 'pnpm', 'yarn', 'gh', 'docker', 'kubectl', 'cargo', 'go', 'make', 'pip', 'pip3', 'uv', 'vibe', 'node', 'python', 'python3', 'deno', 'bun', 'terraform', 'aws', 'gcloud', 'az']);

/** The command words of a shell line, `git push` or `npm run`, without arguments, values or paths. */
function commandHeads(command) {
  const heads = [];
  for (const segment of String(command).split(/&&|\|\||;|\||\n/)) {
    const words = segment.trim().split(/\s+/).filter(word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
    const first = (words[0] ?? '').split('/').pop();
    if (!/^[A-Za-z][\w.+-]{0,40}$/.test(first)) continue;
    const second = words[1] ?? '';
    const head = WITH_SUBCOMMAND.has(first) && /^[a-z][\w:-]{0,30}$/.test(second) ? `${first} ${second}` : first;
    if (!heads.includes(head)) heads.push(head);
  }
  return heads.slice(0, 4);
}

/** Whether a shell call worked, from the fields clients report; null when the response does not say. */
function outcome(response) {
  if (!response || typeof response !== 'object') return null;
  for (const key of ['exit_code', 'exitCode', 'returnCode', 'status']) if (Number.isInteger(response[key])) return response[key] === 0;
  if (response.interrupted === true || response.is_error === true || response.isError === true) return false;
  return null;
}

/** The journal line for a hook event, or null when the event carries nothing worth keeping. */
function entryFor(kind, payload, session, now = Date.now()) {
  const base = { at: now, s: digest(String(session)).slice(0, 8) };
  if (kind === 'prompt') {
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
    if (!prompt) return null;
    return { ...base, k: 'prompt', text: mask(prompt).slice(0, PROMPT_CHARS), ...(CORRECTION.test(prompt) ? { correction: true } : {}) };
  }
  if (kind === 'tool') {
    const heads = commandHeads(payload.tool_input?.command ?? '');
    if (!heads.length) return null;
    return { ...base, k: 'shell', heads, ok: outcome(payload.tool_response) };
  }
  return kind === 'turn' ? { ...base, k: 'turn' } : null;
}

function read(root, home) {
  try {
    return (readPrivate(root, fileName(root), MAX_BYTES, home) ?? '').split('\n').filter(Boolean).flatMap(line => {
      try { const entry = JSON.parse(line); return entry && Number.isFinite(entry.at) && typeof entry.k === 'string' ? [entry] : []; } catch { return []; }
    });
  } catch { return []; }
}

/** Add one line, dropping lines past 30 days and the oldest past the size limits. */
function append(root, entry, home, now = Date.now()) {
  const kept = [...read(root, home).filter(e => e.at >= now - KEEP_DAYS * DAY), entry].slice(-MAX_ENTRIES);
  let text = kept.map(e => JSON.stringify(e)).join('\n');
  while (Buffer.byteLength(text) > MAX_BYTES - 4096 && kept.length > 1) { kept.shift(); text = kept.map(e => JSON.stringify(e)).join('\n'); }
  writePrivate(root, fileName(root), `${text}\n`, home);
}

const words = text => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1));
function similar(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared || 1);
}

/** Instructions given at least three times in at least two sessions, by word overlap. */
function repeatedInstructions(prompts) {
  const groups = [];
  for (const p of prompts.slice(-500)) {
    const set = words(p.text);
    if (set.size < 3) continue;
    const group = groups.find(g => similar(g.set, set) >= 0.6);
    if (group) { group.count++; group.sessions.add(p.s); group.text = p.text; } else groups.push({ set, text: p.text, count: 1, sessions: new Set([p.s]) });
  }
  return groups.filter(g => g.count >= 3 && g.sessions.size >= 2).map(g => ({ text: g.text.slice(0, 200), count: g.count, sessions: g.sessions.size }));
}

/** Three commands run in the same order at least three times across at least two sessions. */
function repeatedSequences(shell) {
  const bySession = new Map();
  for (const e of shell) bySession.set(e.s, [...(bySession.get(e.s) ?? []), e.heads[0]]);
  const counts = new Map();
  for (const [session, heads] of bySession) {
    for (let i = 0; i + 2 < heads.length; i++) {
      if (new Set(heads.slice(i, i + 3)).size < 2) continue;
      const key = heads.slice(i, i + 3).join(' → ');
      const c = counts.get(key) ?? { count: 0, sessions: new Set() };
      c.count++; c.sessions.add(session); counts.set(key, c);
    }
  }
  return [...counts].filter(([, c]) => c.count >= 3 && c.sessions.size >= 2).map(([sequence, c]) => ({ sequence, count: c.count, sessions: c.sessions.size }))
    .sort((a, b) => b.count - a.count).slice(0, 10);
}

/** Commands that failed at least twice. */
function repeatedFailures(shell) {
  const counts = new Map();
  for (const e of shell.filter(e => e.ok === false)) for (const head of e.heads) counts.set(head, (counts.get(head) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= 2).map(([command, count]) => ({ command, count })).sort((a, b) => b.count - a.count).slice(0, 10);
}

/** The lines since the last knowledge turn; during a knowledge turn (the journal ends on its mark), the lines before it. */
function recentWindow(entries) {
  const marks = entries.flatMap((e, i) => (e.k === 'turn' ? [i] : []));
  const last = marks.at(-1) ?? -1;
  return last === entries.length - 1 && last >= 0 ? entries.slice((marks.at(-2) ?? -1) + 1, last) : entries.slice(last + 1);
}

/** What the knowledge turn works from: the recent prompts and corrections in the person's words, and the repeats of 30 days. */
function summarize(entries) {
  const recent = recentWindow(entries);
  const prompts = entries.filter(e => e.k === 'prompt' && typeof e.text === 'string');
  const shell = entries.filter(e => e.k === 'shell' && Array.isArray(e.heads) && e.heads.length);
  return {
    days: KEEP_DAYS,
    entries: entries.filter(e => e.k !== 'turn').length,
    recent: {
      prompts: recent.filter(e => e.k === 'prompt').slice(-12).map(e => e.text.slice(0, 300)),
      corrections: recent.filter(e => e.k === 'prompt' && e.correction).map(e => e.text.slice(0, 300)),
      failed: [...new Set(recent.filter(e => e.k === 'shell' && e.ok === false).flatMap(e => e.heads))],
    },
    repeats: { instructions: repeatedInstructions(prompts), sequences: repeatedSequences(shell), failures: repeatedFailures(shell) },
  };
}

/** One clause for the knowledge turn's reason; empty when the journal holds nothing yet. */
function brief(summary) {
  if (!summary.entries) return '';
  const r = summary.recent, rep = summary.repeats;
  const repeats = rep.instructions.length + rep.sequences.length + rep.failures.length;
  return `; the journal holds ${r.prompts.length} prompts and ${r.corrections.length} corrections since the last knowledge turn and ${repeats} repeats over ${summary.days} days: read them with \`vibe knowledge journal\` and work from them rather than from memory`;
}

module.exports = { mask, commandHeads, outcome, entryFor, read, append, summarize, brief, fileName };
