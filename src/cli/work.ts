import fs from 'node:fs';
import path from 'node:path';
import { runChecks } from '../core/check.js';
import { readDocument } from '../core/docs/read.js';
import { usage } from '../core/errors.js';
import { abandon, approve, draft, intentPath, loadScenarios } from '../core/intent.js';
import { vibePath } from '../core/paths.js';
import { profileFile } from '../core/profile.js';
import { measureSize } from '../core/size.js';
import { listRegressions } from '../core/regress.js';
import { graphMermaid } from '../core/scenarios.js';
import { readJson, readText } from '../core/store.js';
import { buildStateView } from '../core/view.js';
import { ensureProject } from '../install/project.js';
import { flagString, readStdin, type Flags, type Output } from './common.js';

const GLYPH: Record<string, string> = { pass: '✔', fail: '✘', pending: '?', blocked: '⊘', never: '·' };

export function cmdState(root: string, flags: Flags): Output {
  const view = buildStateView(root);
  if (flags['graph'] === true) {
    const scenarios = [...loadScenarios(root), ...listRegressions(root)];
    const graph = graphMermaid(scenarios, (id) => view.scenarios.find((s) => s.id === id)?.last ?? 'never');
    return { json: { ...view, graph }, text: graph, code: 0 };
  }
  const lines = [
    `${view.state} · ${view.stage}${view.intent ? ` · ${view.intent.title}` : ''}`,
    ...view.scenarios.map((s) => `  ${GLYPH[s.last] ?? '·'} ${s.id} [${s.type}]${s.needs ? ` needs ${s.needs.join(', ')}` : ''} ${s.then}${s.regression ? ' (regression)' : ''}${s.irreversible ? ` ⚠ ${s.irreversible}` : ''}`),
    `  remaining ${view.remaining.length ? view.remaining.join(', ') : 'none'}`,
    `  inbox     ${view.inbox.open} open${view.inbox.items.map((q) => `\n    [${q.id}] ${q.question}`).join('')}`,
    ...view.notices.map((n) => `  ! ${n}`),
    ...view.proposals.map((p) => `  → ${p.kind}: ${p.ref}  (${p.why})`),
  ];
  return { json: view, text: lines.join('\n'), code: 0 };
}

export function cmdRead(root: string, file: string | undefined, flags: Flags): Output {
  if (!file) throw usage('read <file.xlsx|docx|pptx|pdf|csv|…> [--sheet name] [--pages A-B]');
  const options: Parameters<typeof readDocument>[2] = {};
  const sheet = flagString(flags, 'sheet');
  const pages = flagString(flags, 'pages');
  if (sheet) options.sheet = sheet;
  if (pages) options.pages = pages;
  const d = readDocument(root, file, options);
  return { json: d, text: `${d.file} · ${d.format} · read by ${d.method} · ${d.sections.length} section(s)${d.truncated ? ' · truncated' : ''}\n\n${d.text}`, code: 0 };
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

export function cmdIntent(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  if (sub === 'show') {
    const scenarios = loadScenarios(root);
    const intent = readText(intentPath(root)) ?? '';
    return { json: { intent, scenarios }, text: `${intent.trim()}\n\n${scenarios.map((s) => `- ${s.id} [${s.check.type}] ${s.then}`).join('\n')}`, code: 0 };
  }
  if (sub !== 'draft') throw usage('intent draft | intent show');
  ensureProject(root);
  let intentText: string;
  let scenariosText: string;
  if (flags['stdin'] === true) {
    const payload = JSON.parse(readStdin()) as { intent?: string; scenarios?: string };
    intentText = payload.intent ?? '';
    scenariosText = payload.scenarios ?? '';
  } else {
    const [intentFile, scenariosFile] = args;
    if (!intentFile || !scenariosFile) throw usage('intent draft <intent.md> <scenarios.yaml> or --stdin');
    intentText = readText(path.resolve(root, intentFile)) ?? '';
    scenariosText = readText(path.resolve(root, scenariosFile)) ?? '';
    if (!intentText) throw usage(`cannot read ${intentFile}`);
    if (!scenariosText) throw usage(`cannot read ${scenariosFile}`);
  }
  const result = draft(root, intentText, scenariosText);
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

export function cmdApprove(root: string, args: string[]): Output {
  ensureProject(root);
  const token = args.join(' ') || null;
  const result = approve(root, token);
  return { json: { ok: true, ...result, state: 'APPROVED' }, text: `APPROVED · ${result.hash} (by ${result.basis})`, code: 0 };
}

export async function cmdCheck(root: string, args: string[], flags: Flags): Promise<Output> {
  ensureProject(root);
  const options = flags['all'] === true ? { all: true } : args.length ? { ids: args } : {};
  const report = await runChecks(root, options);
  const lines = [
    `${report.run} · ${report.state} · pass ${report.passed} · fail ${report.failed}${report.pending ? ` · pending ${report.pending}` : ''}`,
    ...report.outcomes.map((o) => `  ${o.status === 'pass' ? '✔' : o.status === 'fail' ? '✘' : '?'} ${o.id} [${o.type}] exit=${o.exit ?? '-'} ${o.ms}ms${o.reason ? ` — ${o.reason}` : ''}${o.tail && o.status !== 'pass' ? `\n      ${o.tail.split('\n').join('\n      ')}` : ''}`),
    report.done ? '  DONE — every gate scenario passed' : `  remaining ${report.remaining.join(', ') || 'none'}`,
    ...(report.stuck ? ['  STUCK — the same failure twice in a row; see the inbox'] : []),
  ];
  const code = report.stuck || report.failed > 0 ? 1 : 0;
  return { json: report, text: lines.join('\n'), code };
}

export function cmdEvidence(root: string, args: string[]): Output {
  const dir = vibePath(root, 'evidence');
  const runId = args[0] ?? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort((a, b) => Number(a.slice(2, -5)) - Number(b.slice(2, -5))).at(-1)?.replace('.json', '') : undefined);
  if (!runId) throw usage('no evidence yet');
  const evidence = readJson<unknown>(path.join(dir, `${runId}.json`));
  if (!evidence) throw usage(`no such run: ${runId}`);
  return { json: evidence, text: JSON.stringify(evidence, null, 2), code: 0 };
}

export function cmdAbandon(root: string, flags: Flags): Output {
  ensureProject(root);
  abandon(root, flagString(flags, 'reason') ?? '');
  return { json: { state: 'ABANDONED' }, text: 'ABANDONED', code: 0 };
}
