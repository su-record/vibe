import path from 'node:path';
import { usage } from '../core/errors.js';
import { addKnowledge } from '../core/knowledge.js';
import { compare, EDGE_TYPES, readEdges, readLedger, why, type CompareBy, type CompareMetric, type EdgeType } from '../core/ledger.js';
import { listRegressions, recordRegression } from '../core/regress.js';
import { research, SOURCES, type Source } from '../core/research.js';
import type { CheckType } from '../core/scenarios.js';
import { addSkill, createSkill, dismissProposal, listSkills, markUsed, pruneSkills, suggestSkills } from '../core/skills.js';
import { readText } from '../core/store.js';
import { ensureProject } from '../install/project.js';
import { flagString, parseSince, readStdin, type Flags, type Output } from './common.js';

export async function cmdResearch(root: string, sub: string | undefined, flags: Flags): Promise<Output> {
  ensureProject(root);
  const sourcesRaw = flagString(flags, 'sources');
  const sources = sourcesRaw ? sourcesRaw.split(',').map((s) => s.trim()) : undefined;
  if (sources?.some((s) => !SOURCES.includes(s as Source))) throw usage(`--sources ${SOURCES.join(',')}`);
  const options: Parameters<typeof research>[1] = { fromIntent: flags['from-intent'] === true };
  if (sub) options.query = sub;
  if (sources) options.sources = sources as Source[];
  const max = flagString(flags, 'max');
  if (max) options.max = Number(max);
  const r = await research(root, options);
  const lines = [
    `research ${r.queries.map((q) => JSON.stringify(q)).join(' · ')} · ${r.candidates.length} candidates${r.cached ? ' (cached)' : ''}${r.authenticated ? '' : ' · unauthenticated — code search skipped, catalogs only'}`,
    ...r.candidates.map((c) => `  ${c.kind.padEnd(5)} ${c.ref}\n        ${c.why}\n        → ${c.action}`),
    ...(r.file ? [`  note ${path.relative(root, r.file)}`] : []),
  ];
  return { json: r, text: lines.join('\n'), code: 0 };
}

function skillCreateOutput(root: string, name: string | undefined, flags: Flags): Output {
  if (!name) throw usage('skill create <name> --check run|file|http|eval [--from-scenario <id>]');
  const input: Parameters<typeof createSkill>[1] = { name };
  const checkType = flagString(flags, 'check');
  const from = flagString(flags, 'from-scenario');
  if (checkType) input.checkType = checkType as CheckType;
  if (from) input.fromScenario = from;
  const r = createSkill(root, input);
  return { json: r, text: `skill ${r.name} [${r.check.type}] → ${r.paths.join(', ')}\n  fill in SKILL.md: description · When · Procedure. It is installed because it carries a check.`, code: 0 };
}

async function skillAddOutput(root: string, spec: string | undefined, flags: Flags): Promise<Output> {
  if (!spec) throw usage('skill add owner/repo[@name] [--pin <sha>] [--yes]');
  const input: Parameters<typeof addSkill>[1] = { spec, yes: flags['yes'] === true };
  const pin = flagString(flags, 'pin');
  if (pin) input.pin = pin;
  const r = await addSkill(root, input);
  const commands = r.commands.length ? r.commands.map((c) => `    ${c}`).join('\n') : '    (none)';
  if (!r.installed) {
    return { json: r, text: `${r.ref} · ${r.license ?? 'no license'} · files ${r.files.join(', ')}\n  commands the skill would have the model run:\n${commands}\n  nothing installed — rerun with --yes to install these files pinned to ${r.sha.slice(0, 12)}`, code: 3 };
  }
  return { json: r, text: `installed ${r.ref} · ${r.license ?? 'no license'}\n  ${r.paths.join('\n  ')}\n  commands inside:\n${commands}`, code: 0 };
}

function skillSimple(root: string, sub: string, args: string[], flags: Flags): Output {
  if (sub === 'list') {
    const l = listSkills(root);
    const project = l.project.map((s) => `  ${s.name} [${s.kind}] ${s.source}${s.check ? ` · check ${s.check.type}` : ''} · ${s.lastUsedRun === null ? 'never used' : `last used run ${s.lastUsedRun}`} (now ${l.currentRun})`);
    return { json: l, text: [`common  ${l.common.join(' · ')}`, `project ${l.project.length ? '' : '(none)'}`, ...project].join('\n'), code: 0 };
  }
  if (sub === 'used') {
    if (!args[0]) throw usage('skill used <name>');
    const s = markUsed(root, args[0]);
    return { json: s, text: `${s.name} used at run ${s.lastUsedRun}`, code: 0 };
  }
  if (sub === 'prune') {
    const options: Parameters<typeof pruneSkills>[1] = { dryRun: flags['dry-run'] === true };
    const n = flagString(flags, 'unused-runs');
    if (n) options.unusedRuns = Number(n);
    const r = pruneSkills(root, options);
    return { json: r, text: `${options.dryRun ? 'would remove' : 'removed'} ${r.removed.length ? r.removed.join(', ') : 'nothing'} (unused for ${r.threshold} runs) · kept ${r.kept.length ? r.kept.join(', ') : 'none'}`, code: 0 };
  }
  if (sub === 'dismiss') {
    dismissProposal(root, args[0] ?? '');
    return { json: { dismissed: args[0] }, text: 'dismissed — it will not be proposed again', code: 0 };
  }
  const proposals = suggestSkills(root, flags['all'] === true);
  return { json: proposals, text: proposals.length ? proposals.map((p) => `${p.kind.padEnd(9)} ${p.ref}\n          ${p.why} [${p.source}]`).join('\n') : 'no proposals — no signal in scenarios, regressions, inbox or state', code: 0 };
}

export async function cmdSkill(root: string, sub: string | undefined, args: string[], flags: Flags): Promise<Output> {
  if (sub && !['list', 'suggest'].includes(sub)) ensureProject(root);
  switch (sub) {
    case 'create':
      return skillCreateOutput(root, args[0], flags);
    case 'add':
      return skillAddOutput(root, args[0], flags);
    case 'search': {
      if (!args[0]) throw usage('skill search <keyword>');
      const r = await research(root, { query: args[0], sources: ['skills', 'code'] });
      return { json: r, text: r.candidates.length ? r.candidates.map((c) => `${c.ref}\n  ${c.why}\n  → ${c.action}`).join('\n') : `no skill matches "${args[0]}"${r.authenticated ? '' : ' (unauthenticated — catalogs only)'}`, code: 0 };
    }
    case 'suggest':
    case 'list':
    case 'used':
    case 'prune':
    case 'dismiss':
      return skillSimple(root, sub, args, flags);
    default:
      throw usage('skill suggest | create | add | search | list | used | prune | dismiss');
  }
}

export function cmdRegress(root: string, sub: string | undefined, flags: Flags): Output {
  if (sub === 'list') {
    const list = listRegressions(root);
    return { json: list, text: list.length ? list.map((s) => `- ${s.id} [${s.check.type}] ${s.then}`).join('\n') : 'no regressions', code: 0 };
  }
  if (sub !== 'record') throw usage('regress record --scenario <id> --title "…" | regress list');
  ensureProject(root);
  const scenario = flagString(flags, 'scenario');
  const title = flagString(flags, 'title');
  if (!scenario || !title) throw usage('regress record --scenario <id> --title "…"');
  const input: Parameters<typeof recordRegression>[1] = { scenario, title };
  const from = flagString(flags, 'check-from-evidence');
  if (from) input.fromEvidence = from;
  const result = recordRegression(root, input);
  return { json: result, text: `regression ${result.id} → ${path.relative(root, result.file)}`, code: 0 };
}

export function cmdKnowledge(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  ensureProject(root);
  if (sub !== 'add') throw usage('knowledge add <file|--stdin> --title "…"');
  const title = flagString(flags, 'title') ?? '';
  const body = flags['stdin'] === true ? readStdin() : args[0] ? readText(path.resolve(root, args[0])) ?? '' : '';
  const result = addKnowledge(root, title, body);
  return { json: result, text: `knowledge → ${path.relative(root, result.file)}`, code: 0 };
}

export function cmdLedger(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  if (sub === 'why') {
    const node = args[0];
    if (!node) throw usage('ledger why <node>  — a scenario id, regression id, file path, intent hash or run id');
    const result = why(root, node, Number(flagString(flags, 'depth') ?? 3));
    if (!result.node) return { json: result, text: `no edge touches ${node}`, code: 1 };
    const text = [`${result.node}`, ...result.steps.map((s) => `${'  '.repeat(s.depth)}${s.edge.from} ─${s.edge.type}→ ${s.edge.to}  (${s.edge.event} ${s.edge.at})`)].join('\n');
    return { json: result, text, code: 0 };
  }
  if (sub === 'edges') {
    const type = flagString(flags, 'type');
    if (type && !EDGE_TYPES.includes(type as EdgeType)) throw usage(`--type ${EDGE_TYPES.join('|')}`);
    const edges = readEdges(root, type as EdgeType | undefined);
    return { json: edges, text: edges.length ? edges.map((e) => `${e.at} ${e.from} ─${e.type}→ ${e.to}`).join('\n') : 'no edges', code: 0 };
  }
  if (sub === 'compare') {
    const by = (flagString(flags, 'by') ?? 'client') as CompareBy;
    const metric = (flagString(flags, 'metric') ?? 'checks') as CompareMetric;
    if (!['client', 'model', 'harness'].includes(by)) throw usage('--by client|model|harness');
    if (!['checks', 'turns', 'cost'].includes(metric)) throw usage('--metric checks|turns|cost');
    const minRuns = Number(flagString(flags, 'min-runs') ?? 5);
    const c = compare(root, by, metric, minRuns, flagString(flags, 'ledger'));
    const text = [
      `compare by ${by} · metric ${metric} · verdict ${c.verdict}`,
      `  ${c.reason}`,
      ...c.arms.map((a) => `  ${a.arm}: runs ${a.runs} · usable ${a.usable}${a.range ? ` · min ${a.range.min} · max ${a.range.max} · mean ${a.range.mean.toFixed(2)}` : ''}`),
      ...(c.delta !== null ? [`  delta ${c.delta.toFixed(2)} (absolute units)`] : []),
    ].join('\n');
    return { json: c, text, code: 0 };
  }
  const events = readLedger(root, parseSince(flagString(flags, 'since')));
  const text = events.map((e) => `${e.at} ${e.event.padEnd(9)} ${e.client}${e.model ? `/${e.model}` : ''}${e.run ? ` ${e.run}` : ''}${typeof e.passed === 'number' ? ` pass ${e.passed} fail ${e.failed ?? 0}` : ''}${e.detail ? ` ${e.detail}` : ''}`).join('\n');
  return { json: events, text: text || 'ledger is empty', code: 0 };
}
