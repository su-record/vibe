#!/usr/bin/env node
/**
 * vibe CLI — 판정·기록·토큰. 스킬은 셸로 이것을 부른다.
 * 규약: 모든 명령은 --json 을 받는다. 종료 코드가 판정이다 (errors.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { runChecks } from './core/check.js';
import { detectClient, detectModel } from './core/client.js';
import { denied, usage, VibeError } from './core/errors.js';
import { answer, ask, openQuestions, resolve as resolveQuestion } from './core/inbox.js';
import { abandon, approve, draft, intentPath, loadScenarios, scenariosPath } from './core/intent.js';
import { addKnowledge } from './core/knowledge.js';
import { compare, readLedger, record, type CompareBy, type CompareMetric } from './core/ledger.js';
import { findProjectRoot, hasVibe, vibePath } from './core/paths.js';
import { listRegressions, recordRegression } from './core/regress.js';
import { readState } from './core/state.js';
import { readJson, readText } from './core/store.js';
import { verifyAndConsume } from './core/tokens.js';
import { buildStateView } from './core/view.js';
import { ALL_CLIENTS, initProject, statusProject, uninstallProject, type Client } from './install/project.js';

type Flags = Record<string, string | boolean>;
interface Parsed {
  positionals: string[];
  flags: Flags;
}

const BOOLEAN_FLAGS = new Set(['json', 'all', 'stdin', 'purge-state', 'dry-run', 'yes', 'help', 'version']);

export function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (eq !== -1) {
      flags[key] = arg.slice(eq + 1);
    } else if (BOOLEAN_FLAGS.has(key) || i + 1 >= argv.length || (argv[i + 1] as string).startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = argv[i + 1] as string;
      i += 1;
    }
  }
  return { positionals, flags };
}

function flagString(flags: Flags, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

const HELP = `vibe — AX/FDE 하네스. 판정은 하네스가, 승인은 사람이.

  설치·환경   init [--client claude,codex,chatgpt] · status · uninstall [--purge-state]
  작업 상태   state · intent draft <intent.md> <scenarios.yaml> | --stdin · intent show
              approve <token> · check [id…] [--all] · evidence [run] · abandon --reason "…"
  사람 개입   ask "질문" [--options "a|b"] [--default a] [--needs approve|authorize:<행동>] [--target "…"]
              authorize <token> --action push|deploy|send|delete|spend [--target "…"] · inbox [list|answer <id> "답"|resolve <id>]
  기억        regress record --scenario <id> --title "…" [--check-from-evidence <run>] · regress list
              knowledge add <file|--stdin> --title "…"
  장부        ledger [--since 7d] · ledger compare --by client|model --metric checks|turns|cost [--min-runs 5]

모든 명령은 --json 을 받는다. 종료 코드: 0 성공 · 1 판정 실패 · 2 사용 오류 · 3 토큰 오류 · 4 상태 전이 불가
`;

interface Output {
  json: unknown;
  text: string;
  code: number;
}

function requireVibe(root: string): void {
  if (!hasVibe(root)) throw usage('.vibe/ 가 없다 — 먼저 `vibe init` 을 실행한다');
}

function readStdin(): string {
  return fs.readFileSync(0, 'utf-8');
}

function parseSince(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+)([dhm])$/.exec(value);
  if (!match) throw usage('--since 는 7d · 12h · 30m 형식이다');
  const n = Number(match[1]);
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2] as 'd' | 'h' | 'm'];
  return n * unit;
}

// ─── 명령 ───────────────────────────────────────────────────────────

function cmdInit(root: string, flags: Flags): Output {
  const raw = flagString(flags, 'client');
  const clients = raw ? raw.split(',').map((c) => c.trim()) : ['claude'];
  const bad = clients.filter((c) => !ALL_CLIENTS.includes(c as Client));
  if (bad.length > 0) throw usage(`알 수 없는 클라이언트: ${bad.join(', ')} (claude, codex, chatgpt)`);
  const report = initProject(root, clients as Client[]);
  const lines = [
    `vibe init — ${root}`,
    `  clients   ${report.clients.join(', ')}`,
    `  created   ${report.created.length ? report.created.join(', ') : '(이미 있음)'}`,
    ...Object.entries(report.card).map(([file, how]) => `  card      ${file} ${how} (${report.cardBytes} bytes)`),
    ...Object.entries(report.skills).map(([dir, names]) => `  skills    ${dir}: ${names.join(', ')}`),
    `  hook      ${report.hook ?? '(claude 아님)'}`,
  ];
  return { json: report, text: lines.join('\n'), code: 0 };
}

function cmdStatus(root: string): Output {
  const s = statusProject(root);
  const lines = [
    `vibe status — ${root}`,
    `  .vibe     ${s.vibe ? 'ok' : 'missing (vibe init)'}`,
    `  state     ${s.state}`,
    `  card      ${s.cardBytes} bytes${s.cardOver ? ' — 1KB 초과!' : ''} · CLAUDE.md ${s.cards['CLAUDE.md'] ? 'ok' : '-'} · AGENTS.md ${s.cards['AGENTS.md'] ? 'ok' : '-'}`,
    `  skills    ${Object.entries(s.skills).map(([d, n]) => `${d} ${n}`).join(' · ')}`,
    `  hook      ${s.hook ? 'ok' : 'missing'}`,
    `  inbox     ${s.inboxOpen} open`,
  ];
  return { json: s, text: lines.join('\n'), code: 0 };
}

function cmdUninstall(root: string, flags: Flags): Output {
  const removed = uninstallProject(root, flags['purge-state'] !== true);
  return { json: { removed }, text: removed.length ? `removed: ${removed.join(', ')}` : 'nothing to remove', code: 0 };
}

function cmdState(root: string): Output {
  requireVibe(root);
  const view = buildStateView(root);
  const lines = [
    `${view.state} · ${view.stage}${view.intent ? ` · ${view.intent.title}` : ''}`,
    ...view.scenarios.map((s) => `  ${s.last === 'pass' ? '✔' : s.last === 'fail' ? '✘' : s.last === 'pending' ? '?' : '·'} ${s.id} [${s.type}] ${s.then}${s.regression ? ' (회귀)' : ''}${s.irreversible ? ` ⚠ ${s.irreversible}` : ''}`),
    `  remaining ${view.remaining.length ? view.remaining.join(', ') : '없음'}`,
    `  inbox     ${view.inbox.open} open${view.inbox.items.map((q) => `\n    [${q.id}] ${q.question}`).join('')}`,
    ...view.notices.map((n) => `  ! ${n}`),
  ];
  return { json: view, text: lines.join('\n'), code: 0 };
}

function cmdIntent(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  requireVibe(root);
  if (sub === 'show') {
    const scenarios = loadScenarios(root);
    const intent = readText(intentPath(root)) ?? '';
    return { json: { intent, scenarios }, text: `${intent.trim()}\n\n${scenarios.map((s) => `- ${s.id} [${s.check.type}] ${s.then}`).join('\n')}`, code: 0 };
  }
  if (sub !== 'draft') throw usage('intent draft | intent show');
  let intentText: string;
  let scenariosText: string;
  if (flags['stdin'] === true) {
    const payload = JSON.parse(readStdin()) as { intent?: string; scenarios?: string };
    intentText = payload.intent ?? '';
    scenariosText = payload.scenarios ?? '';
  } else {
    const [intentFile, scenariosFile] = args;
    if (!intentFile || !scenariosFile) throw usage('intent draft <intent.md> <scenarios.yaml> 또는 --stdin');
    intentText = readText(path.resolve(root, intentFile)) ?? '';
    scenariosText = readText(path.resolve(root, scenariosFile)) ?? '';
    if (!intentText) throw usage(`읽을 수 없다: ${intentFile}`);
    if (!scenariosText) throw usage(`읽을 수 없다: ${scenariosFile}`);
  }
  const result = draft(root, intentText, scenariosText);
  if (!result.ok) {
    return { json: result, text: `반려 ${result.rejections.length}건 — 저장하지 않았다\n${result.rejections.map((r) => `  ${r.id}: ${r.reason}`).join('\n')}`, code: 1 };
  }
  const text = [
    `DRAFT 저장 · ${result.scenarios.length} 시나리오 · hash ${result.hash}`,
    ...result.scenarios.map((s) => `  ${s.id} [${s.check.type}] ${s.then}${s.irreversible ? ` ⚠ ${s.irreversible}` : ''}`),
    `승인 토큰: ${result.token} (${result.expiresAt} 까지) — 사용자에게 보여 주고, 사용자가 붙여넣으면 \`vibe approve <token>\``,
  ].join('\n');
  return { json: result, text, code: 0 };
}

function cmdApprove(root: string, args: string[]): Output {
  requireVibe(root);
  const token = args.join(' ');
  if (!token) throw usage('approve <token>');
  const result = approve(root, token);
  return { json: { ok: true, ...result, state: 'APPROVED' }, text: `APPROVED · ${result.hash}`, code: 0 };
}

async function cmdCheck(root: string, args: string[], flags: Flags): Promise<Output> {
  requireVibe(root);
  const options = flags['all'] === true ? { all: true } : args.length ? { ids: args } : {};
  const report = await runChecks(root, options);
  const lines = [
    `${report.run} · ${report.state} · pass ${report.passed} · fail ${report.failed}${report.pending ? ` · pending ${report.pending}` : ''}`,
    ...report.outcomes.map((o) => `  ${o.status === 'pass' ? '✔' : o.status === 'fail' ? '✘' : '?'} ${o.id} [${o.type}] exit=${o.exit ?? '-'} ${o.ms}ms${o.reason ? ` — ${o.reason}` : ''}${o.tail && o.status !== 'pass' ? `\n      ${o.tail.split('\n').join('\n      ')}` : ''}`),
    report.done ? '  DONE — 모든 게이트 시나리오 통과' : `  remaining ${report.remaining.join(', ') || '없음'}`,
    ...(report.stuck ? ['  STUCK — 같은 실패 2회 연속. 인박스를 본다'] : []),
  ];
  const code = report.stuck || report.failed > 0 ? 1 : 0;
  return { json: report, text: lines.join('\n'), code };
}

function cmdEvidence(root: string, args: string[]): Output {
  requireVibe(root);
  const dir = vibePath(root, 'evidence');
  const runId = args[0] ?? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort((a, b) => Number(a.slice(2, -5)) - Number(b.slice(2, -5))).at(-1)?.replace('.json', '') : undefined);
  if (!runId) throw usage('evidence 가 없다');
  const evidence = readJson<unknown>(path.join(dir, `${runId}.json`));
  if (!evidence) throw usage(`없는 run: ${runId}`);
  return { json: evidence, text: JSON.stringify(evidence, null, 2), code: 0 };
}

function cmdAbandon(root: string, flags: Flags): Output {
  requireVibe(root);
  abandon(root, flagString(flags, 'reason') ?? '');
  return { json: { state: 'ABANDONED' }, text: 'ABANDONED', code: 0 };
}

function cmdAsk(root: string, args: string[], flags: Flags): Output {
  requireVibe(root);
  const question = args.join(' ');
  if (!question) throw usage('ask "질문"');
  const options = flagString(flags, 'options')?.split('|').map((s) => s.trim()).filter(Boolean);
  const needsRaw = flagString(flags, 'needs');
  let needs: { kind: 'approve' | 'authorize'; target: string } | undefined;
  if (needsRaw === 'approve') {
    const state = readState(root);
    if (state.state !== 'DRAFT' || !state.intentHash) throw denied('승인 토큰은 DRAFT 상태에서만 발급된다');
    needs = { kind: 'approve', target: state.intentHash };
  } else if (needsRaw?.startsWith('authorize:')) {
    const action = needsRaw.slice('authorize:'.length);
    needs = { kind: 'authorize', target: `${action}:${flagString(flags, 'target') ?? ''}` };
  } else if (needsRaw) {
    throw usage('--needs 는 approve 또는 authorize:<행동>');
  }
  const input: Parameters<typeof ask>[1] = { question };
  if (options && options.length) input.options = options;
  const def = flagString(flags, 'default');
  if (def) input.default = def;
  if (needs) input.needs = needs;
  const result = ask(root, input);
  record(root, { event: 'ask', client: detectClient(), model: detectModel(), detail: question.slice(0, 120) });
  const text = [`질문 기록 [${result.id}]`, ...(result.token ? [`토큰: ${result.token} (${result.expiresAt} 까지) — 사용자가 채팅에 붙여넣어야 진행된다`] : [])].join('\n');
  return { json: result, text, code: 0 };
}

function cmdAuthorize(root: string, args: string[], flags: Flags): Output {
  requireVibe(root);
  const token = args.join(' ');
  const action = flagString(flags, 'action');
  if (!token || !action) throw usage('authorize <token> --action push|deploy|send|delete|spend [--target "…"]');
  const target = `${action}:${flagString(flags, 'target') ?? ''}`;
  const verdict = verifyAndConsume(root, 'authorize', target, token);
  if (!verdict.ok) throw denied(verdict.reason);
  record(root, { event: 'authorize', client: detectClient(), model: detectModel(), detail: target });
  return { json: { ok: true, action, target }, text: `authorized: ${target}`, code: 0 };
}

function cmdInbox(root: string, sub: string | undefined, args: string[]): Output {
  requireVibe(root);
  if (sub === 'answer') {
    const [id, ...rest] = args;
    if (!id || rest.length === 0) throw usage('inbox answer <id> "답"');
    if (!answer(root, id, rest.join(' '))) throw usage(`없는 질문: ${id}`);
    return { json: { ok: true }, text: `answered ${id}`, code: 0 };
  }
  if (sub === 'resolve') {
    const [id] = args;
    if (!id) throw usage('inbox resolve <id>');
    if (!resolveQuestion(root, id)) throw usage(`없는 질문: ${id}`);
    return { json: { ok: true }, text: `resolved ${id}`, code: 0 };
  }
  const open = openQuestions(root);
  return { json: open, text: open.length ? open.map((q) => `[${q.id}] ${q.question}${q.options ? ` (${q.options.join(' | ')})` : ''}${q.answer ? `\n    답: ${q.answer}` : ''}`).join('\n') : '인박스 비어 있음', code: 0 };
}

function cmdRegress(root: string, sub: string | undefined, flags: Flags): Output {
  requireVibe(root);
  if (sub === 'list') {
    const list = listRegressions(root);
    return { json: list, text: list.length ? list.map((s) => `- ${s.id} [${s.check.type}] ${s.then}`).join('\n') : '회귀 없음', code: 0 };
  }
  if (sub !== 'record') throw usage('regress record --scenario <id> --title "…" | regress list');
  const scenario = flagString(flags, 'scenario');
  const title = flagString(flags, 'title');
  if (!scenario || !title) throw usage('regress record --scenario <id> --title "…"');
  const input: Parameters<typeof recordRegression>[1] = { scenario, title };
  const from = flagString(flags, 'check-from-evidence');
  if (from) input.fromEvidence = from;
  const result = recordRegression(root, input);
  return { json: result, text: `regression ${result.id} → ${path.relative(root, result.file)}`, code: 0 };
}

function cmdKnowledge(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  requireVibe(root);
  if (sub !== 'add') throw usage('knowledge add <file|--stdin> --title "…"');
  const title = flagString(flags, 'title') ?? '';
  const body = flags['stdin'] === true ? readStdin() : args[0] ? readText(path.resolve(root, args[0])) ?? '' : '';
  const result = addKnowledge(root, title, body);
  return { json: result, text: `knowledge → ${path.relative(root, result.file)}`, code: 0 };
}

function cmdLedger(root: string, sub: string | undefined, flags: Flags): Output {
  requireVibe(root);
  if (sub === 'compare') {
    const by = (flagString(flags, 'by') ?? 'client') as CompareBy;
    const metric = (flagString(flags, 'metric') ?? 'checks') as CompareMetric;
    if (!['client', 'model'].includes(by)) throw usage('--by client|model');
    if (!['checks', 'turns', 'cost'].includes(metric)) throw usage('--metric checks|turns|cost');
    const minRuns = Number(flagString(flags, 'min-runs') ?? 5);
    const c = compare(root, by, metric, minRuns);
    const text = [
      `compare by ${by} · metric ${metric} · verdict ${c.verdict}`,
      `  ${c.reason}`,
      ...c.arms.map((a) => `  ${a.arm}: runs ${a.runs} · usable ${a.usable}${a.range ? ` · min ${a.range.min} · max ${a.range.max} · mean ${a.range.mean.toFixed(2)}` : ''}`),
      ...(c.delta !== null ? [`  delta ${c.delta.toFixed(2)} (절대 단위)`] : []),
    ].join('\n');
    return { json: c, text, code: 0 };
  }
  const events = readLedger(root, parseSince(flagString(flags, 'since')));
  const text = events.map((e) => `${e.at} ${e.event.padEnd(9)} ${e.client}${e.model ? `/${e.model}` : ''}${e.run ? ` ${e.run}` : ''}${typeof e.passed === 'number' ? ` pass ${e.passed} fail ${e.failed ?? 0}` : ''}${e.detail ? ` ${e.detail}` : ''}`).join('\n');
  return { json: events, text: text || '장부 비어 있음', code: 0 };
}

// ─── 디스패치 ───────────────────────────────────────────────────────

export async function dispatch(argv: string[]): Promise<Output> {
  const { positionals, flags } = parseArgs(argv);
  const [cmd, sub, ...rest] = positionals;
  if (!cmd || flags['help'] === true) return { json: { help: HELP }, text: HELP, code: 0 };
  if (cmd === 'version' || flags['version'] === true) {
    const pkg = readJson<{ version: string }>(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json'));
    return { json: { version: pkg?.version }, text: pkg?.version ?? 'unknown', code: 0 };
  }
  const root = cmd === 'init' ? process.cwd() : findProjectRoot();
  switch (cmd) {
    case 'init':
      return cmdInit(root, flags);
    case 'status':
      return cmdStatus(root);
    case 'uninstall':
      return cmdUninstall(root, flags);
    case 'state':
      return cmdState(root);
    case 'intent':
      return cmdIntent(root, sub, rest, flags);
    case 'approve':
      return cmdApprove(root, [sub, ...rest].filter((s): s is string => Boolean(s)));
    case 'check':
      return cmdCheck(root, [sub, ...rest].filter((s): s is string => Boolean(s)), flags);
    case 'evidence':
      return cmdEvidence(root, [sub, ...rest].filter((s): s is string => Boolean(s)));
    case 'abandon':
      return cmdAbandon(root, flags);
    case 'ask':
      return cmdAsk(root, [sub, ...rest].filter((s): s is string => Boolean(s)), flags);
    case 'authorize':
      return cmdAuthorize(root, [sub, ...rest].filter((s): s is string => Boolean(s)), flags);
    case 'inbox':
      return cmdInbox(root, sub, rest);
    case 'regress':
      return cmdRegress(root, sub, flags);
    case 'knowledge':
      return cmdKnowledge(root, sub, rest, flags);
    case 'ledger':
      return cmdLedger(root, sub, flags);
    default:
      throw usage(`알 수 없는 명령: ${cmd}\n${HELP}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  try {
    const out = await dispatch(argv);
    process.stdout.write(wantsJson ? `${JSON.stringify(out.json, null, 2)}\n` : `${out.text}\n`);
    process.exitCode = out.code;
  } catch (error) {
    const code = error instanceof VibeError ? error.exitCode : 2;
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(wantsJson ? `${JSON.stringify({ error: message, code })}\n` : `vibe: ${message}\n`);
    process.exitCode = code;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) void main();
