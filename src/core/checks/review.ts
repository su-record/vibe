import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { detectLang } from '../lang.js';
import type { ReviewCheck } from '../scenarios.js';
import { packStages, TEXT_PACKS } from './packs.js';
import { collectSource } from './source.js';
import { tail, type CheckResult } from './run.js';

const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_SOURCE_CHARS = 400_000;
const MAX_CAPTURE = 256 * 1024;

/** The reviewer command: `VIBE_REVIEW_CMD` (tests, custom clients), else the client CLI on PATH. The prompt goes to stdin, the reply is stdout. */
export function reviewerCommand(): string | null {
  const custom = process.env['VIBE_REVIEW_CMD'];
  if (custom) return custom;
  const has = (name: string): boolean => spawnSync(name, ['--version'], { encoding: 'utf-8', timeout: 15_000, shell: process.platform === 'win32' }).status === 0;
  if (has('claude')) return 'claude -p --output-format text';
  if (has('codex')) return 'codex exec --skip-git-repo-check -';
  return null;
}

function readOptional(root: string, file: string | undefined): string {
  if (!file) return '(not provided)';
  const full = path.resolve(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : `(missing file: ${file})`;
}

function bundle(instructions: string, contract: string, evidence: string, body: string, screenshot: string): string {
  return `${instructions.trim()}\n\n---\n\n## Editorial contract\n\n${contract.trim()}\n\n## Evidence ledger\n\n${evidence.trim()}${screenshot}\n\n${body}\n`;
}

/** A text pack judges a manuscript; every other pack judges source, one file or a directory of them. */
function artifact(check: ReviewCheck, root: string, pack: string): { section: string; body: string } {
  if ((TEXT_PACKS as readonly string[]).includes(pack)) {
    return { section: 'Manuscript', body: fs.readFileSync(path.resolve(root, check.path), 'utf-8') };
  }
  const collected = collectSource(root, check.path, MAX_SOURCE_CHARS);
  return { section: 'Source', body: collected.text };
}

/** The pack: what the check names, else the text pack for `lang`, else the language of the text itself. */
function choosePack(check: ReviewCheck, root: string): string | null {
  if (check.pack) return check.pack;
  if (check.lang) return check.lang;
  const file = path.resolve(root, check.path);
  return fs.statSync(file).isDirectory() ? null : detectLang(fs.readFileSync(file, 'utf-8'));
}

function ask(cmd: string, cwd: string, prompt: string, timeoutMs: number): Promise<{ reply: string; exit: number | null; killed: boolean }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, VIBE_CHECK: '1' };
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
    }, timeoutMs);
    child.on('error', () => resolve({ reply, exit: null, killed }));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ reply, exit: code, killed });
    });
    child.stdin.end(prompt);
  });
}

/**
 * `review` check — the harness itself runs the pack's reviewer stages in order and reads their
 * verdict. A stage passes only when the whole trimmed reply is exactly `PASS`; a REJECT list, a
 * remark after PASS, an empty or killed reply all fail, with the reply kept in `tail`. Nothing is
 * edited here: the reviewers judge, the writer fixes.
 */
export async function reviewCheck(check: ReviewCheck, root: string): Promise<CheckResult> {
  const started = Date.now();
  const fail = (reason: string, text = ''): CheckResult => ({ pass: false, exit: 1, ms: Date.now() - started, tail: tail(text), reason });
  if (!fs.existsSync(path.resolve(root, check.path))) return fail(`artifact missing: ${check.path}`);
  const pack = choosePack(check, root);
  if (!pack) return fail('language unknown — set lang: ko|en or pack: <name> on the check');
  const stages = packStages(pack);
  if (stages.length === 0) return fail(`no reviewers/${pack} in this package`);
  const cmd = reviewerCommand();
  if (!cmd) return fail('no reviewer available — needs `claude` or `codex` on PATH, or VIBE_REVIEW_CMD');
  let piece: { section: string; body: string };
  try {
    piece = artifact(check, root, pack);
  } catch (error) {
    return fail((error as Error).message);
  }
  const contract = readOptional(root, check.contract);
  const evidence = readOptional(root, check.evidence);
  const shot = check.screenshot ? `\n\n## Screenshot\n\n${path.resolve(root, check.screenshot)} — open this image with your file reader before judging.` : '';
  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lines: string[] = [];
  for (const stage of stages) {
    const instructions = fs.readFileSync(stage.file, 'utf-8');
    const prompt = bundle(instructions, contract, evidence, `## ${piece.section}\n\n${piece.body}`, shot);
    const r = await ask(cmd, root, prompt, timeoutMs);
    if (r.killed) return fail(`${stage.name}: killed after ${timeoutMs}ms`, lines.join('\n'));
    const verdict = r.reply.trim();
    if (verdict === 'PASS') {
      lines.push(`${pack} ${stage.name}: PASS`);
      continue;
    }
    lines.push(`${pack} ${stage.name}: ${verdict === '' ? `no reply (exit ${r.exit})` : 'not PASS'}`, verdict);
    return fail(`${stage.name} did not pass`, lines.join('\n'));
  }
  return { pass: true, exit: 0, ms: Date.now() - started, tail: lines.join('\n') };
}
