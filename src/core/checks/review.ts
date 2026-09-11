import fs from 'node:fs';
import path from 'node:path';
import { detectLang } from '../lang.js';
import { recordUsage } from '../ledger.js';
import { roleChoice } from '../config.js';
import { claudeArgs, codexArgs, driverLabel, hasCli, parseClaude, parseCodex, readerHome, REVIEWER_DRIVER, spawnReader, withChoice, type DriverOptions, type ReaderClient, type ReaderUsage } from '../readerSession.js';
import type { ReviewCheck } from '../scenarios.js';
import { ensureDir } from '../store.js';
import { packStages, TEXT_PACKS } from './packs.js';
import { collectChanged } from './changed.js';
import { collectSource } from './source.js';
import { tail, type CheckResult } from './run.js';
import type { OutputObserver } from '../check-process.js';
import { outputCapture } from '../output-capture.js';

const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_SOURCE_CHARS = 400_000;

export interface ReviewerChoice {
  client: ReaderClient;
  label: string;
  cmd: string;
  driver?: DriverOptions;
}

/**
 * The reviewer: `VIBE_REVIEW_CMD` (a stateless text command — tests, custom clients), else the
 * client CLI on PATH through the slim driver, `VIBE_REVIEW_CLIENT` forcing one. The model is the
 * client's default: judgment keeps the strong model; only the project context is dropped.
 */
export function chooseReviewer(root: string = process.cwd()): ReviewerChoice | null {
  const custom = process.env['VIBE_REVIEW_CMD'];
  if (custom) return { client: 'custom', label: custom, cmd: custom };
  const driver = withChoice(REVIEWER_DRIVER, roleChoice(root, 'reviewer'));
  const pick = (client: 'claude' | 'codex'): ReviewerChoice => ({ client, label: `${driverLabel(client, driver)} (slim)`, cmd: client, driver });
  const forced = process.env['VIBE_REVIEW_CLIENT'];
  if (forced === 'claude' || forced === 'codex') return pick(forced);
  if (hasCli('claude')) return pick('claude');
  if (hasCli('codex')) return pick('codex');
  return null;
}

/** Kept for callers that only want the command string. */
export function reviewerCommand(root: string = process.cwd()): string | null {
  return chooseReviewer(root)?.label ?? null;
}

function readOptional(root: string, file: string | undefined): string {
  if (!file) return '(not provided)';
  const full = path.resolve(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : `(missing file: ${file})`;
}

function message(contract: string, evidence: string, body: string, screenshot: string): string {
  return `## Editorial contract\n\n${contract.trim()}\n\n## Evidence ledger\n\n${evidence.trim()}${screenshot}\n\n${body}\n`;
}

/** A text pack judges a manuscript; every other pack judges source — a file, a directory, or with `changed` the change and its dependents. */
function artifact(check: ReviewCheck, root: string, pack: string): { section: string; body: string; nothing?: string } {
  if ((TEXT_PACKS as readonly string[]).includes(pack)) {
    return { section: 'Manuscript', body: fs.readFileSync(path.resolve(root, check.path), 'utf-8') };
  }
  const kind = pack === 'code' ? 'code' : 'design';
  if (check.changed) {
    const c = collectChanged(root, check.path, MAX_SOURCE_CHARS, kind, check.changed === true ? true : check.changed);
    if (c.selection.changed.length === 0) return { section: 'Source', body: '', nothing: `nothing changed under ${check.path} since ${c.selection.ref} — nothing reviewed` };
    return { section: 'Source', body: c.text };
  }
  const collected = collectSource(root, check.path, MAX_SOURCE_CHARS, kind);
  return { section: 'Source', body: collected.text };
}

/** The pack: what the check names, else the text pack for `lang`, else the language of the text itself. */
function choosePack(check: ReviewCheck, root: string): string | null {
  if (check.pack) return check.pack;
  if (check.lang) return check.lang;
  const file = path.resolve(root, check.path);
  return fs.statSync(file).isDirectory() ? null : detectLang(fs.readFileSync(file, 'utf-8'));
}

interface StageRun {
  raw: { stdout: Buffer; stderr: Buffer };
  failureCode: string | null;
  reply: string;
  usage: ReaderUsage | null;
  costUsd: number | null;
  model: string | null;
  exit: number | null;
  killed: boolean;
}

/** One stage: the custom command gets instructions + message on stdin in the project; a client driver gets the instructions as its system prompt (Claude) or leading the message (Codex), in the neutral directory. */
async function askStage(choice: ReviewerChoice, instructions: string, message: string, root: string, timeoutMs: number, onOutput: OutputObserver): Promise<StageRun> {
  if (choice.client === 'custom') {
    const r = await spawnReader(choice.cmd, null, `${instructions.trim()}\n\n---\n\n${message}`, root, timeoutMs, onOutput);
    return { raw: r.raw, failureCode: r.failureCode, reply: r.out, usage: null, costUsd: null, model: null, exit: r.exit, killed: r.killed };
  }
  const cwd = readerHome();
  ensureDir(cwd);
  const claude = choice.client === 'claude';
  const driver = choice.driver ?? REVIEWER_DRIVER;
  const args = claude ? claudeArgs(instructions.trim(), null, driver) : codexArgs(null, driver);
  const r = await spawnReader(choice.cmd, args, claude ? message : `${instructions.trim()}\n\n---\n\n${message}`, cwd, timeoutMs, onOutput);
  const parsed = claude ? parseClaude(r.out) : parseCodex(r.out);
  return { ...parsed, raw: r.raw, failureCode: r.failureCode, exit: r.exit, killed: r.killed };
}

function usageLine(u: ReaderUsage | null): string {
  return u ? ` · in ${u.input.toLocaleString('en-US')} · cache read ${u.cacheRead.toLocaleString('en-US')} · out ${u.output.toLocaleString('en-US')}` : '';
}

/**
 * `review` check — the harness itself runs the pack's reviewer stages in order and reads their
 * verdict. A stage passes only when the whole trimmed reply is exactly `PASS`; a REJECT list, a
 * remark after PASS, an empty or killed reply all fail, with the reply kept in `tail`. Nothing is
 * edited here: the reviewers judge, the writer fixes.
 */
export async function reviewCheck(check: ReviewCheck, root: string): Promise<CheckResult> {
  const started = Date.now();
  const streams = outputCapture();
  const fail = (reason: string, text = '', complete = true): CheckResult => ({ ...streams.finish(complete), pass: false, exit: 1, ms: Date.now() - started, tail: tail(text), reason, failureCode: 'review-failed' });
  if (!fs.existsSync(path.resolve(root, check.path))) return fail(`artifact missing: ${check.path}`);
  const pack = choosePack(check, root);
  if (!pack) return fail('language unknown — set lang: ko|en or pack: <name> on the check');
  const stages = packStages(pack);
  if (stages.length === 0) return fail(`no reviewers/${pack} in this package`);
  const choice = chooseReviewer(root);
  if (!choice) return fail('no reviewer available — needs `claude` or `codex` on PATH, or VIBE_REVIEW_CMD');
  let piece: { section: string; body: string; nothing?: string };
  try {
    piece = artifact(check, root, pack);
  } catch (error) {
    return fail((error as Error).message);
  }
  if (piece.nothing) return { pass: true, exit: 0, ms: Date.now() - started, tail: piece.nothing };
  const contract = readOptional(root, check.contract);
  const evidence = readOptional(root, check.evidence);
  const shot = check.screenshot ? `\n\n## Screenshot\n\n${path.resolve(root, check.screenshot)} — open this image with your file reader before judging.` : '';
  const timeoutMs = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lines: string[] = [];
  const usage: Array<{ stage: string } & ReaderUsage> = [];
  for (const stage of stages) {
    const instructions = fs.readFileSync(stage.file, 'utf-8');
    const r = await askStage(choice, instructions, message(contract, evidence, `## ${piece.section}\n\n${piece.body}`, shot), root, timeoutMs, streams.add);
    if (r.usage) usage.push({ stage: stage.name, ...r.usage });
    const chosen = choice.driver ? (choice.client === 'claude' ? choice.driver.model : choice.driver.codexModel) : null;
    recordUsage(root, { detail: `review ${pack}/${stage.name}`, client: choice.client, model: r.model ?? chosen, tokens: r.usage, costUsd: r.costUsd, ms: Date.now() - started });
    if (r.failureCode || r.exit !== 0) return { ...fail(r.failureCode ?? 'reviewer-exit', '', r.failureCode === null), failureCode: r.failureCode ?? 'reviewer-exit', usage };
    if (r.killed) return fail(`${stage.name}: killed after ${timeoutMs}ms`, lines.join('\n'), false);
    const verdict = r.reply.trim();
    if (verdict === 'PASS') {
      lines.push(`${pack} ${stage.name}: PASS${usageLine(r.usage)}`);
      continue;
    }
    lines.push(`${pack} ${stage.name}: ${verdict === '' ? `no reply (exit ${r.exit})` : 'not PASS'}${usageLine(r.usage)}`, verdict);
    return { ...fail(`${stage.name} did not pass`, lines.join('\n')), usage };
  }
  return { ...streams.finish(true), pass: true, exit: 0, ms: Date.now() - started, tail: lines.join('\n'), usage };
}
