import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { detectLang } from '../lang.js';
import { packageRoot } from '../paths.js';
import type { ReviewCheck } from '../scenarios.js';
import { tail, type CheckResult } from './run.js';

const STAGES = ['copy-editor', 'chief-editor'] as const;
const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_CAPTURE = 256 * 1024;

/** The reviewer command: `VIBE_REVIEW_CMD` (tests, custom clients), else the client CLI on PATH. The prompt goes to stdin, the reply is stdout. */
export function reviewerCommand(): string | null {
  const custom = process.env['VIBE_REVIEW_CMD'];
  if (custom) return custom;
  const has = (name: string): boolean => spawnSync(name, ['--version'], { encoding: 'utf-8', timeout: 15_000, shell: process.platform === 'win32' }).status === 0;
  if (has('claude')) return 'claude -p --output-format text';
  if (has('codex')) return 'codex exec -';
  return null;
}

function reviewerPrompt(lang: string, stage: string): string | null {
  const file = path.join(packageRoot(), 'reviewers', lang, `${stage}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}

function readOptional(root: string, file: string | undefined): string {
  if (!file) return '(not provided)';
  const full = path.resolve(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : `(missing file: ${file})`;
}

function bundle(instructions: string, contract: string, evidence: string, manuscript: string): string {
  return `${instructions.trim()}\n\n---\n\n## Editorial contract\n\n${contract.trim()}\n\n## Evidence ledger\n\n${evidence.trim()}\n\n## Manuscript\n\n${manuscript}\n`;
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
 * `review` check — the harness itself runs the language pack's reviewers in order (copy editor,
 * then chief editor) and reads their verdict. A stage passes only when the whole trimmed reply is
 * exactly `PASS`; a REJECT list, a remark after PASS, an empty or killed reply all fail, with the
 * reply kept in `tail`. The manuscript is never edited here.
 */
export async function reviewCheck(check: ReviewCheck, root: string): Promise<CheckResult> {
  const started = Date.now();
  const fail = (reason: string, text = ''): CheckResult => ({ pass: false, exit: 1, ms: Date.now() - started, tail: tail(text), reason });
  const file = path.resolve(root, check.path);
  if (!fs.existsSync(file)) return fail(`manuscript missing: ${check.path}`);
  const manuscript = fs.readFileSync(file, 'utf-8');
  const lang = check.lang ?? detectLang(manuscript);
  if (!lang) return fail(`language unknown — set lang: ko|en on the check`);
  const cmd = reviewerCommand();
  if (!cmd) return fail('no reviewer available — needs `claude` or `codex` on PATH, or VIBE_REVIEW_CMD');
  const contract = readOptional(root, check.contract);
  const evidence = readOptional(root, check.evidence);
  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lines: string[] = [];
  for (const stage of STAGES) {
    const instructions = reviewerPrompt(lang, stage);
    if (!instructions) return fail(`no ${lang} ${stage} in this package`);
    const r = await ask(cmd, root, bundle(instructions, contract, evidence, manuscript), timeoutMs);
    if (r.killed) return fail(`${stage}: killed after ${timeoutMs}ms`, lines.join('\n'));
    const verdict = r.reply.trim();
    if (verdict === 'PASS') {
      lines.push(`${lang} ${stage}: PASS`);
      continue;
    }
    lines.push(`${lang} ${stage}: ${verdict === '' ? `no reply (exit ${r.exit})` : 'not PASS'}`, verdict);
    return fail(`${stage} did not pass`, lines.join('\n'));
  }
  return { pass: true, exit: 0, ms: Date.now() - started, tail: lines.join('\n') };
}
