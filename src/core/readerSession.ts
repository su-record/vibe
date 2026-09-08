import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ensureDir, readJson, writeJson } from './store.js';

/**
 * Reader sessions — the cache is the harness's to manage. A file set is sent to the reader once;
 * every later question over the same files resumes that reader session and sends only the
 * question, so the corpus is read from the model's prompt cache. The key is the reader plus the
 * exact bundle text: a changed byte is a new session. Entries expire with the cache, one hour.
 */
export type ReaderClient = 'claude' | 'codex' | 'custom';

export interface ReaderUsage {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export interface ReaderRun extends Parsed {
  exit: number | null;
  killed: boolean;
}

export interface SessionEntry {
  id: string;
  client: ReaderClient;
  at: string;
  files: string[];
  chars: number;
}

export const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_CAPTURE = 1024 * 1024;

export function readerHome(home: string = process.env['VIBE_HOME_DIR'] ?? os.homedir()): string {
  return path.join(home, '.config', 'vibe', 'reader');
}

export function sessionKey(client: ReaderClient, bundleText: string): string {
  return createHash('sha256').update(`${client}\n${bundleText}`).digest('hex').slice(0, 24);
}

function sessionsFile(home?: string): string {
  return path.join(readerHome(home), 'sessions.json');
}

export function findSession(key: string, home?: string, now = Date.now()): SessionEntry | null {
  const all = readJson<Record<string, SessionEntry>>(sessionsFile(home)) ?? {};
  const entry = all[key];
  if (!entry) return null;
  return now - new Date(entry.at).getTime() <= SESSION_TTL_MS ? entry : null;
}

/** Store one entry and drop every expired one on the way. */
export function saveSession(key: string, entry: SessionEntry, home?: string, now = Date.now()): void {
  const all = readJson<Record<string, SessionEntry>>(sessionsFile(home)) ?? {};
  const kept: Record<string, SessionEntry> = {};
  for (const [k, e] of Object.entries(all)) if (now - new Date(e.at).getTime() <= SESSION_TTL_MS) kept[k] = e;
  kept[key] = entry;
  ensureDir(readerHome(home));
  writeJson(sessionsFile(home), kept);
}

export function hasCli(name: string): boolean {
  return spawnSync(name, ['--version'], { encoding: 'utf-8', timeout: 15_000, shell: process.platform === 'win32' }).status === 0;
}

interface Spawned {
  out: string;
  exit: number | null;
  killed: boolean;
}

/** Spawn a reader in the neutral directory with the prompt on stdin. `args` null means a shell command string. */
export function spawnReader(cmd: string, args: string[] | null, stdin: string, cwd: string, timeoutMs: number): Promise<Spawned> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env['CLAUDECODE']; // a nested client CLI must not think it is inside itself
    const child = args === null
      ? spawn(cmd, { cwd, shell: true, env, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(cmd, args, { cwd, shell: process.platform === 'win32', env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let killed = false;
    child.stdout.on('data', (chunk: Buffer) => {
      if (out.length < MAX_CAPTURE) out += chunk.toString('utf-8');
    });
    child.stderr.on('data', () => undefined);
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', () => resolve({ out, exit: null, killed }));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ out, exit: code, killed });
    });
    child.stdin.end(stdin);
  });
}

export interface DriverOptions {
  /** Claude model: `haiku` for the reader; null keeps the client's default — judgment keeps the strong model. */
  model: string | null;
  /** Claude tools the process may use; the reader gets none, a reviewer gets its file tools. */
  tools: string[];
  /** Claude reasoning effort (`--effort`); null keeps the default. */
  effort: string | null;
  /** Codex model (`-m`); null keeps the default. */
  codexModel: string | null;
  /** Codex reasoning effort; null keeps the default. */
  codexEffort: string | null;
}
export const READER_DRIVER: DriverOptions = { model: 'haiku', tools: [], effort: null, codexModel: null, codexEffort: 'low' };
/** A reviewer reads the artifact inline; `Read` is for a screenshot. Every other tool schema is tokens on every stage (measured: Read 1.1k, Grep 1k, WebFetch+WebSearch 0.5k). */
export const REVIEWER_DRIVER: DriverOptions = { model: null, tools: ['Read'], effort: null, codexModel: null, codexEffort: null };

/** The project's choice for a role laid over the driver's defaults — the same `model`/`effort` reach whichever client runs. */
export function withChoice(base: DriverOptions, choice: { model?: string; effort?: string }): DriverOptions {
  return {
    ...base,
    model: choice.model ?? base.model,
    effort: choice.effort ?? base.effort,
    codexModel: choice.model ?? base.codexModel,
    codexEffort: choice.effort ?? base.codexEffort,
  };
}

/** What a driver runs at, for a label or a session key: `claude haiku` · `codex default/low` · `claude big/high`. */
export function driverLabel(client: 'claude' | 'codex', options: DriverOptions): string {
  const model = client === 'claude' ? options.model : options.codexModel;
  const effort = client === 'claude' ? options.effort : options.codexEffort;
  return `${client} ${model ?? 'default'}${effort ? `/${effort}` : ''}`;
}

/** `claude -p` slim: its own system prompt, only the tools named, no settings, no project — the message is the only context. */
export function claudeArgs(instructions: string, resume: string | null, options: DriverOptions = READER_DRIVER): string[] {
  const model = options.model ? ['--model', options.model] : [];
  const effort = options.effort ? ['--effort', options.effort] : [];
  return ['-p', ...(resume ? ['--resume', resume] : []), '--system-prompt', instructions, '--output-format', 'json', ...model, ...effort, '--tools', options.tools.join(','), '--disable-slash-commands', '--strict-mcp-config', '--setting-sources', ''];
}

/** `codex exec` slim; `--json` carries the thread id and the token usage. */
export function codexArgs(resume: string | null, options: DriverOptions = READER_DRIVER): string[] {
  const head = resume ? ['exec', '--skip-git-repo-check', 'resume', resume] : ['exec', '--skip-git-repo-check'];
  const model = options.codexModel ? ['-m', options.codexModel] : [];
  const effort = options.codexEffort ? ['-c', `model_reasoning_effort=${options.codexEffort}`] : [];
  return [...head, '--json', ...model, ...effort, '-'];
}

interface ClaudeJson {
  session_id?: string;
  result?: string;
  is_error?: boolean;
  total_cost_usd?: number;
  modelUsage?: Record<string, unknown>;
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number };
}

export interface Parsed {
  reply: string;
  sessionId: string | null;
  usage: ReaderUsage | null;
  costUsd: number | null;
  model: string | null;
}

export function parseClaude(out: string): Parsed {
  try {
    const j = JSON.parse(out) as ClaudeJson;
    const u = j.usage;
    const usage = u ? { input: u.input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0 } : null;
    const model = j.modelUsage ? Object.keys(j.modelUsage)[0] ?? null : null;
    return { reply: j.is_error ? '' : (j.result ?? ''), sessionId: j.session_id ?? null, usage, costUsd: typeof j.total_cost_usd === 'number' ? j.total_cost_usd : null, model };
  } catch {
    return { reply: out, sessionId: null, usage: null, costUsd: null, model: null };
  }
}

interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: { type?: string; text?: string };
  usage?: { input_tokens?: number; cached_input_tokens?: number; cache_write_input_tokens?: number; output_tokens?: number };
}

export function parseCodex(out: string): Parsed {
  let reply = '';
  let sessionId: string | null = null;
  let usage: ReaderUsage | null = null;
  for (const line of out.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    let e: CodexEvent;
    try {
      e = JSON.parse(line) as CodexEvent;
    } catch {
      continue;
    }
    if (e.type === 'thread.started' && e.thread_id) sessionId = e.thread_id;
    if (e.type === 'item.completed' && e.item?.type === 'agent_message' && typeof e.item.text === 'string') reply = e.item.text;
    if (e.type === 'turn.completed' && e.usage) {
      const cached = e.usage.cached_input_tokens ?? 0;
      usage = { input: Math.max(0, (e.usage.input_tokens ?? 0) - cached), cacheRead: cached, cacheWrite: e.usage.cache_write_input_tokens ?? 0, output: e.usage.output_tokens ?? 0 };
    }
  }
  return { reply, sessionId, usage, costUsd: null, model: null };
}
