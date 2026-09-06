import { spawn, spawnSync } from 'node:child_process';
import { readConfig } from './config.js';
import { readDocument } from './docs/read.js';
import { usage } from './errors.js';

/**
 * `vibe read --ask` — the harness reads for the model. The files go to a low-reasoning reader
 * model and only its answer comes back, so the frontier model's context holds the answer, not
 * the corpus. Text and code lines are numbered before they leave, so the answer can cite them —
 * the part a plain summary loses. Editing and debugging still read the real file (card rule 8).
 */
export const READER_MAX_CHARS = 400_000;
const TIMEOUT_MS = 300_000;
const MAX_CAPTURE = 1024 * 1024;

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

export interface ReaderReply {
  files: string[];
  chars: number;
  reader: string;
  reply: string;
  ms: number;
  exit: number | null;
}

const NO_READER = 'no reader available — set VIBE_READER_CMD, put `reader` in .vibe/config.json, or have `claude` or `codex` on PATH';

/** The reader command: env, project config, then the client CLI on PATH at its lowest reasoning. The bundle goes to stdin, the answer is stdout. */
export function readerCommand(root: string): string | null {
  const custom = process.env['VIBE_READER_CMD'] || readConfig(root).reader;
  if (custom) return custom;
  const has = (name: string): boolean => spawnSync(name, ['--version'], { encoding: 'utf-8', timeout: 15_000, shell: process.platform === 'win32' }).status === 0;
  if (has('claude')) return 'claude -p --output-format text --model haiku';
  if (has('codex')) return 'codex exec -c model_reasoning_effort=low -';
  return null;
}

export function numberLines(text: string): string {
  const lines = text.replace(/\n$/, '').split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width)}| ${line}`).join('\n');
}

/** Every file as a `<file>` block: documents through the readers, code and text numbered line by line. */
export function bundleFiles(root: string, files: string[], options: { sheet?: string; pages?: string } = {}): ReadBundle {
  if (files.length === 0) throw usage('read <file…> --ask "<question>"');
  const blocks: string[] = [];
  let chars = 0;
  for (const file of files) {
    const doc = readDocument(root, file, { ...options, maxChars: READER_MAX_CHARS });
    const body = doc.format === 'text' ? numberLines(doc.sections.map((s) => s.text).join('\n')) : doc.text;
    chars += body.length;
    if (chars > READER_MAX_CHARS) throw usage(`the files exceed ${READER_MAX_CHARS} characters at ${file} — ask about fewer files, or use --pages / --sheet`);
    blocks.push(`<file path="${file}" format="${doc.format}">\n${body}\n</file>`);
  }
  return { files, chars, text: blocks.join('\n\n') };
}

export function readerPrompt(bundle: ReadBundle, question: string): string {
  return `${INSTRUCTIONS}\n\n${bundle.text}\n\n## Question\n\n${question.trim()}\n`;
}

function run(cmd: string, cwd: string, prompt: string): Promise<{ reply: string; exit: number | null; killed: boolean }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env['CLAUDECODE']; // a nested client CLI must not think it is inside itself
    const child = spawn(cmd, { cwd, shell: true, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let reply = '';
    let killed = false;
    child.stdout.on('data', (chunk: Buffer) => {
      if (reply.length < MAX_CAPTURE) reply += chunk.toString('utf-8');
    });
    child.stderr.on('data', () => undefined);
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    child.on('error', () => resolve({ reply, exit: null, killed }));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ reply, exit: code, killed });
    });
    child.stdin.end(prompt);
  });
}

export async function askReader(root: string, files: string[], question: string, options: { sheet?: string; pages?: string } = {}): Promise<ReaderReply> {
  if (!question.trim()) throw usage('--ask needs a question');
  const reader = readerCommand(root);
  if (!reader) throw usage(NO_READER);
  const bundle = bundleFiles(root, files, options);
  const started = Date.now();
  const r = await run(reader, root, readerPrompt(bundle, question));
  const ms = Date.now() - started;
  if (r.killed) throw usage(`the reader gave no answer within ${TIMEOUT_MS}ms: ${reader}`);
  if (r.exit !== 0) throw usage(`the reader failed (exit ${r.exit ?? 'none'}): ${reader}${r.reply.trim() ? `\n${r.reply.trim()}` : ''}`);
  return { files: bundle.files, chars: bundle.chars, reader, reply: r.reply.trim(), ms, exit: r.exit };
}
