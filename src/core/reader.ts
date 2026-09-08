import { readConfig, roleChoice } from './config.js';
import { readDocument } from './docs/read.js';
import { usage } from './errors.js';
import { recordUsage } from './ledger.js';
import { skeletonBlock } from './map/format.js';
import { symbolsOf } from './map/index.js';
import { claudeArgs, codexArgs, driverLabel, findSession, hasCli, parseClaude, parseCodex, READER_DRIVER, readerHome, saveSession, sessionKey, spawnReader, withChoice, type DriverOptions, type ReaderClient, type ReaderRun, type ReaderUsage } from './readerSession.js';
import { SOURCE } from './size.js';
import { ensureDir } from './store.js';

/**
 * `vibe read --ask` — the harness reads for the model. The files go to a low-reasoning reader
 * model and only its answer comes back, so the frontier model's context holds the answer, not
 * the corpus. Text and code lines are numbered before they leave, so the answer can cite them —
 * the part a plain summary loses. Editing and debugging still read the real file (card rule 8).
 */
export const READER_MAX_CHARS = 400_000;
const TIMEOUT_MS = 300_000;

const INSTRUCTIONS = [
  'You are a reader. Answer the question at the end from the files below and nothing else.',
  'Cite the file path and the line number (the number before "|") for every claim.',
  'Be exact and brief: no preamble, no restatement of the files, no advice beyond the question.',
].join('\n');

export interface ReadBundle {
  files: string[];
  chars: number;
  text: string;
}

export function numberLines(text: string): string {
  const lines = text.replace(/\n$/, '').split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)}| ${line}`).join('\n');
}

/** A code file's skeleton — one line per symbol — so a question about a function is answered with the function in view; empty when the file has no symbols or fails to parse. */
function codeSkeleton(root: string, file: string): string {
  try {
    const symbols = symbolsOf(root, file);
    return symbols.length ? `${skeletonBlock(file, symbols)}\n` : '';
  } catch {
    return '';
  }
}

/** Every file as a `<file>` block: documents through the readers, code and text numbered line by line, a code file preceded by its skeleton. */
export function bundleFiles(root: string, files: string[], options: { sheet?: string; pages?: string } = {}): ReadBundle {
  if (files.length === 0) throw usage('read <file…> --ask "<question>"');
  const blocks: string[] = [];
  let chars = 0;
  for (const file of files) {
    const doc = readDocument(root, file, { ...options, maxChars: READER_MAX_CHARS });
    const body = doc.format === 'text' ? numberLines(doc.sections.map((s) => s.text).join('\n')) : doc.text;
    const skeleton = doc.format === 'text' && SOURCE.test(file) ? codeSkeleton(root, file) : '';
    chars += skeleton.length + body.length;
    if (chars > READER_MAX_CHARS) throw usage(`the files exceed ${READER_MAX_CHARS} characters at ${file} — ask about fewer files, or use --pages / --sheet`);
    blocks.push(`${skeleton}<file path="${file}" format="${doc.format}">\n${body}\n</file>`);
  }
  return { files, chars, text: blocks.join('\n\n') };
}

export function readerPrompt(bundle: ReadBundle, question: string): string {
  return `${INSTRUCTIONS}\n\n${bundle.text}\n\n## Question\n\n${question.trim()}\n`;
}

export interface ReaderChoice {
  client: ReaderClient;
  /** The command as reported to the caller */
  label: string;
  cmd: string;
  /** The client driver's options once the project's model choice is applied; absent for a custom command. */
  driver?: DriverOptions;
}

const NO_READER = 'no reader available — set VIBE_READER_CMD, put `reader` in .vibe/config.json, or have `claude` or `codex` on PATH';

/** The reader, in order: env, project config (both stateless shell commands), then the client CLI on PATH at its lowest reasoning. */
export function chooseReader(root: string): ReaderChoice | null {
  const custom = process.env['VIBE_READER_CMD'] || readConfig(root).reader;
  if (custom) return { client: 'custom', label: custom, cmd: custom };
  const driver = withChoice(READER_DRIVER, roleChoice(root, 'reader'));
  if (hasCli('claude')) return { client: 'claude', label: driverLabel('claude', driver), cmd: 'claude', driver };
  if (hasCli('codex')) return { client: 'codex', label: driverLabel('codex', driver), cmd: 'codex', driver };
  return null;
}

/** Kept for callers that only want the command string. */
export function readerCommand(root: string): string | null {
  return chooseReader(root)?.label ?? null;
}

export interface ReaderReply {
  files: string[];
  chars: number;
  reader: string;
  session: { id: string | null; resumed: boolean };
  usage: ReaderUsage | null;
  reply: string;
  ms: number;
}

interface AskOptions {
  sheet?: string;
  pages?: string;
  home?: string;
  now?: number;
}

function firstMessage(choice: ReaderChoice, bundle: ReadBundle, question: string): string {
  const body = `${bundle.text}\n\n## Question\n\n${question.trim()}\n`;
  return choice.client === 'claude' ? body : `${INSTRUCTIONS}\n\n${body}`; // claude carries the instructions as its system prompt
}

function followUp(question: string): string {
  return `Same files as before.\n\n## Question\n\n${question.trim()}\n`;
}

async function runChoice(choice: ReaderChoice, resume: string | null, stdin: string, root: string, home: string | undefined): Promise<ReaderRun> {
  if (choice.client === 'custom') {
    const r = await spawnReader(choice.cmd, null, stdin, root, TIMEOUT_MS); // a user's command runs where the user wrote it
    return { reply: r.out, sessionId: null, usage: null, costUsd: null, model: null, exit: r.exit, killed: r.killed };
  }
  const cwd = readerHome(home); // the client CLIs run in a neutral directory: no project card, memory or hooks
  ensureDir(cwd);
  const driver = choice.driver ?? READER_DRIVER;
  const args = choice.client === 'claude' ? claudeArgs(INSTRUCTIONS, resume, driver) : codexArgs(resume, driver);
  const r = await spawnReader(choice.cmd, args, stdin, cwd, TIMEOUT_MS);
  const parsed = choice.client === 'claude' ? parseClaude(r.out) : parseCodex(r.out);
  return { ...parsed, exit: r.exit, killed: r.killed };
}

export async function askReader(root: string, files: string[], question: string, options: AskOptions = {}): Promise<ReaderReply> {
  if (!question.trim()) throw usage('--ask needs a question');
  const choice = chooseReader(root);
  if (!choice) throw usage(NO_READER);
  const bundle = bundleFiles(root, files, options);
  const key = sessionKey(choice.client, `${choice.label}\n${bundle.text}`); // a different model or effort is a different session
  const existing = choice.client === 'custom' ? null : findSession(key, options.home, options.now);
  const started = Date.now();
  const r = await runChoice(choice, existing?.id ?? null, existing ? followUp(question) : firstMessage(choice, bundle, question), root, options.home);
  const ms = Date.now() - started;
  if (r.killed) throw usage(`the reader gave no answer within ${TIMEOUT_MS}ms: ${choice.label}`);
  if (r.exit !== 0) throw usage(`the reader failed (exit ${r.exit ?? 'none'}): ${choice.label}${r.reply.trim() ? `\n${r.reply.trim()}` : ''}`);
  if (r.sessionId) saveSession(key, { id: r.sessionId, client: choice.client, at: new Date(options.now ?? Date.now()).toISOString(), files: bundle.files, chars: bundle.chars }, options.home, options.now);
  const chosen = choice.driver ? (choice.client === 'claude' ? choice.driver.model : choice.driver.codexModel) : null;
  recordUsage(root, { detail: 'reader', client: choice.client, model: r.model ?? chosen, tokens: r.usage, costUsd: r.costUsd, ms });
  return { files: bundle.files, chars: bundle.chars, reader: choice.label, session: { id: r.sessionId, resumed: existing !== null }, usage: r.usage, reply: r.reply.trim(), ms };
}
