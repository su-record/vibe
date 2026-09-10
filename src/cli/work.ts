import fs from 'node:fs';
import path from 'node:path';
import { analyzeIntent, renderAnalysis } from '../core/analyze.js';
import { runChecks } from '../core/check.js';
import { readDocument } from '../core/docs/read.js';
import { usage } from '../core/errors.js';
import { abandon, approve, draft, intentPath, loadScenarios } from '../core/intent.js';
import { vibePath } from '../core/paths.js';
import { profileFile } from '../core/profile.js';
import { askReader } from '../core/reader.js';
import { measureSize } from '../core/size.js';
import { listRegressions } from '../core/regress.js';
import { graphMermaid } from '../core/scenarios.js';
import { readJson, readText } from '../core/store.js';
import { sourceValidity } from '../core/source-basis.js';
import { buildStateView } from '../core/view.js';
import { ensureProject } from '../install/project.js';
import { flagString, readStdin, type Flags, type Output } from './common.js';
import { executionPlan, inspectContract } from '../core/inspect.js';
import { consentStatus } from '../core/consent.js';
import { renderEvidence } from '../core/evidence.js';
import { handoffScenario, reopenScenario } from '../core/handoff.js';

const GLYPH: Record<string, string> = { pass: '✔', fail: '✘', pending: '?', blocked: '⊘', never: '·', stale: '↻' };

export function cmdState(root: string, flags: Flags): Output {
  const view = buildStateView(root);
  if (flags['graph'] === true) {
    const scenarios = [...loadScenarios(root), ...listRegressions(root)];
    const graph = graphMermaid(scenarios, (id) => view.scenarios.find((s) => s.id === id)?.last ?? 'never');
    return { json: { ...view, graph }, text: graph, code: 0 };
  }
  const lines = [
    `${view.state} · ${view.stage}${view.intent ? ` · ${view.intent.title}` : ''}`,
    `  next      ${view.next}`,
    `  size      ${view.size}`,
    ...view.scenarios.map((s) => `  ${GLYPH[s.last] ?? '·'} ${s.id} [${s.type}]${s.needs ? ` needs ${s.needs.join(', ')}` : ''} ${s.then}${s.regression ? ' (regression)' : ''}${s.irreversible ? ` ⚠ ${s.irreversible}` : ''} — check: ${s.check}${s.files ? ` — files: ${s.files.join(', ')}` : ''}`),
    `  remaining ${view.remaining.length ? view.remaining.join(', ') : 'none'}`,
    `  inbox     ${view.inbox.open} open${view.inbox.items.map((q) => `\n    [${q.id}] ${q.question}${q.answer ? ` → ${q.answer}` : ' (waiting)'}`).join('')}`,
    '  commands  vibe check --all (runs every check itself — build, tests; do not run them by hand) · vibe check <id> · vibe context <id> · vibe ask "question" [--options a|b] [--default a] (then stop and wait for the answer) · vibe regress record --scenario <id> --title "…"',
    ...view.notices.map((n) => `  ! ${n}`),
    ...view.proposals.map((p) => `  → ${p.kind}: ${p.ref}  (${p.why})`),
  ];
  return { json: view, text: lines.join('\n'), code: 0 };
}

export async function cmdRead(root: string, files: string[], flags: Flags): Promise<Output> {
  if (files.length === 0) throw usage('read <file…> [--sheet name] [--pages A-B] [--ask "question"]');
  const options: Parameters<typeof readDocument>[2] = {};
  const sheet = flagString(flags, 'sheet');
  const pages = flagString(flags, 'pages');
  if (sheet) options.sheet = sheet;
  if (pages) options.pages = pages;
  const ask = flagString(flags, 'ask');
  if (ask !== undefined || flags['ask'] === true) {
    const r = await askReader(root, files, ask ?? '', options);
    const u = r.usage;
    const session = r.session.id ? `session ${r.session.resumed ? 'resumed' : 'new'}` : 'no session';
    const cache = u ? `cache read ${u.cacheRead.toLocaleString('en-US')} · write ${u.cacheWrite.toLocaleString('en-US')} · input ${u.input.toLocaleString('en-US')}` : `${r.reply.length} chars out`;
    if (flags['json'] !== true) process.stderr.write(`[vibe read] ${r.files.length} file(s) · ${r.chars.toLocaleString('en-US')} chars · ${r.reader} · ${session} · ${cache} · ${(r.ms / 1000).toFixed(1)}s\n`);
    return { json: r, text: r.reply, code: 0 };
  }
  const docs = files.map((file) => readDocument(root, file, options));
  const text = docs.map((d) => `${d.file} · ${d.format} · read by ${d.method} · ${d.sections.length} section(s)${d.truncated ? ' · truncated' : ''}\n\n${d.text}`).join('\n\n');
  return { json: docs.length === 1 ? docs[0] : docs, text, code: 0 };
}

export function cmdSize(root: string, args: string[], flags: Flags): Output {
  const maxFile = Number(flagString(flags, 'max-file') ?? 400);
  const maxFunction = Number(flagString(flags, 'max-function') ?? 50);
  const r = measureSize(root, args, { maxFile, maxFunction });
  const lines = [
    `${r.files} files · ${r.totalLines} lines · largest ${r.largestFile ? `${r.largestFile.file} (${r.largestFile.lines})` : '-'} · limits file ${maxFile} · function ${maxFunction}`,
    ...r.findings.map((f) => `  ✘ ${f.kind === 'file' ? f.file : `${f.file} › ${f.name}()`} ${f.lines} lines (limit ${f.limit})`),
    r.findings.length ? `  ${r.findings.length} over the limit` : '  every file and function within limits',
  ];
  return { json: r, text: lines.join('\n'), code: r.findings.length ? 1 : 0 };
}

export function cmdProfile(root: string, file: string | undefined, flags: Flags): Output {
  if (!file) throw usage('profile <file.csv|tsv|jsonl|json|xlsx> [--sheet name]');
  const p = profileFile(root, file, flagString(flags, 'sheet'));
  const lines = [
    `${p.file} · ${p.format} · ${p.rows} rows · ${p.columns.length} columns · ${p.duplicateRows} duplicate rows`,
    ...p.anomalies.map((a) => `  ! ${a}`),
    ...p.columns.map((c) => `  ${c.name || '(no header)'} ${c.type}${c.missing ? ` · missing ${c.missing}` : ''} · distinct ${c.distinct}${c.min !== undefined ? ` · ${c.min}…${c.max}` : ''} · e.g. ${c.sample.map((s) => JSON.stringify(s)).join(', ')}`),
  ];
  return { json: p, text: lines.join('\n'), code: 0 };
}

function draftInput(root: string, args: string[], flags: Flags): { intent: string; scenarios: string; sources?: string[] } {
  if (flags['sources'] === true) throw usage('--sources requires comma-separated input file paths');
  if (flags['stdin'] === true) {
    if (flags['sources'] !== undefined) throw usage('with --stdin, supply sources in the JSON payload');
    return JSON.parse(readStdin()) as { intent: string; scenarios: string; sources?: string[] };
  }
  const [intentFile, scenariosFile] = args;
  if (!intentFile || !scenariosFile) throw usage('intent draft <intent.md> <scenarios.yaml> [--sources a,b] or --stdin');
  const intent = readText(path.resolve(root, intentFile)) ?? '';
  const scenarios = readText(path.resolve(root, scenariosFile)) ?? '';
  if (!intent) throw usage(`cannot read ${intentFile}`);
  if (!scenarios) throw usage(`cannot read ${scenariosFile}`);
  const sources = flagString(flags, 'sources');
  return sources === undefined ? { intent, scenarios } : { intent, scenarios, sources: sources.split(',').map((file) => file.trim()) };
}

export function cmdIntent(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  if (sub === 'inspect') {
    const inspected = inspectContract(root, args);
    return { json: inspected, text: `Untrusted contract data; no checks executed.\n${JSON.stringify(inspected, null, 2)}`, code: inspected.rejections.length ? 1 : 0 };
  }
  if (sub === 'show') {
    const scenarios = loadScenarios(root);
    const intent = readText(intentPath(root)) ?? '';
    const sourceBasis = sourceValidity(root);
    const sources = sourceBasis ? `\n\nSource basis: ${sourceBasis.valid ? 'unchanged' : 're-evaluate changed or missing inputs'}\n${sourceBasis.sources.map((source) => `- ${source.path}: ${source.status}`).join('\n')}` : '';
    return { json: { intent, scenarios, sourceBasis }, text: `${intent.trim()}\n\n${scenarios.map((s) => `- ${s.id} [${s.check.type}] ${s.then}`).join('\n')}${sources}`, code: 0 };
  }
  if (sub === 'analyze') {
    const analysis = analyzeIntent(root);
    return { json: analysis, text: renderAnalysis(analysis), code: 0 };
  }
  if (sub !== 'draft') throw usage('intent draft | intent show | intent analyze');
  const input = draftInput(root, args, flags);
  ensureProject(root);
  const result = draft(root, input.intent ?? '', input.scenarios ?? '', input.sources);
  if (!result.ok) {
    return { json: result, text: `rejected ${result.rejections.length} — nothing was saved\n${result.rejections.map((r) => `  ${r.id}: ${r.reason}`).join('\n')}`, code: 1 };
  }
  const text = [
    `DRAFT saved · ${result.scenarios.length} scenarios · hash ${result.hash}`,
    ...result.scenarios.map((s) => `  ${s.id} [${s.check.type}] ${s.then}${s.irreversible ? ` ⚠ ${s.irreversible}` : ''}`),
    result.token
      ? `approval token: ${result.token} (valid until ${result.expiresAt}) — show it to the user; when they paste it back, run \`vibe approve <token>\``
      : `tokens: ${result.policy} — when the user says yes in chat, run \`vibe approve\``,
  ].join('\n');
  return { json: result, text, code: 0 };
}

export function cmdApprove(root: string, args: string[], flags: Flags = {}): Output {
  if (flags['preview'] === true) {
    const plan = executionPlan(root);
    const consent = consentStatus(root, plan);
    const preview = { plan, consent, untrusted: true, executed: false };
    return { json: preview, text: `Execution plan preview; no commands executed or approval saved.\n${JSON.stringify(preview, null, 2)}`, code: 0 };
  }
  ensureProject(root);
  const token = args.join(' ') || null;
  const result = approve(root, token);
  return { json: { ok: true, ...result, state: 'APPROVED' }, text: `APPROVED · ${result.hash} (by ${result.basis})`, code: 0 };
}

export async function cmdCheck(root: string, args: string[], flags: Flags): Promise<Output> {
  ensureProject(root);
  const options = flags['all'] === true ? { all: true } : args.length ? { ids: args } : {};
  const report = await runChecks(root, { ...options, diagnostics: flags['diagnostics'] === true });
  const files = new Map(buildStateView(root).scenarios.map((s) => [s.id, s.files ?? []]));
  const lines = [
    `${report.run} · ${report.state} · pass ${report.passed} · fail ${report.failed}${report.pending ? ` · pending ${report.pending}` : ''}`,
    ...report.outcomes.map((o) => `  ${o.status === 'pass' ? '✔' : o.status === 'fail' ? '✘' : '?'} ${o.id} [${o.type}] exit=${o.exit ?? '-'} ${o.ms}ms${o.reason ? ` — ${o.reason}` : ''}${o.status === 'fail' && files.get(o.id)?.length ? ` — files: ${files.get(o.id)!.join(', ')}` : ''}${o.tail && o.status !== 'pass' ? `\n      ${o.tail.split('\n').join('\n      ')}` : ''}`),
    report.done ? '  DONE — every gate scenario passed' : `  remaining ${report.remaining.join(', ') || 'none'}`,
    ...(report.stuck ? ['  STUCK — the same failure twice in a row; see the inbox'] : []),
    `  next      ${buildStateView(root).next}`,
  ];
  const code = report.stuck || report.failed > 0 || report.outcomes.some((outcome) => outcome.status === 'handoff') ? 1 : 0;
  return { json: { ...report, next: buildStateView(root).next }, text: lines.join('\n'), code };
}

export function cmdEvidence(root: string, args: string[]): Output {
  const dir = vibePath(root, 'evidence');
  const runId = args[0] ?? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort((a, b) => Number(a.slice(2, -5)) - Number(b.slice(2, -5))).at(-1)?.replace('.json', '') : undefined);
  if (!runId) throw usage('no evidence yet');
  const evidence = readJson<unknown>(path.join(dir, `${runId}.json`));
  if (!evidence) throw usage(`no such run: ${runId}`);
  const rendered = renderEvidence(evidence);
  return { json: rendered, text: JSON.stringify(rendered, null, 2), code: 0 };
}

export function cmdAbandon(root: string, flags: Flags): Output {
  const scenario = flagString(flags, 'scenario');
  if (scenario) {
    const handoff = handoffScenario(root, scenario, { reason: flagString(flags, 'reason') ?? '', category: flagString(flags, 'category') ?? '', nextAction: flagString(flags, 'next') ?? '', ...(flagString(flags, 'owner') ? { owner: flagString(flags, 'owner')! } : {}) });
    return { json: { status: 'handoff', passed: false, handoff }, text: `HANDOFF ${scenario} — required work remains unmet`, code: 0 };
  }
  ensureProject(root);
  abandon(root, flagString(flags, 'reason') ?? '');
  return { json: { state: 'ABANDONED' }, text: 'ABANDONED', code: 0 };
}

export function cmdReopen(root: string, args: string[], flags: Flags): Output {
  if (args.length !== 1) throw usage('reopen <scenario> --reason "…"');
  reopenScenario(root, args[0]!, flagString(flags, 'reason') ?? '');
  return { json: { status: 'reopened', scenario: args[0] }, text: `REOPENED ${args[0]} — original check required`, code: 0 };
}
