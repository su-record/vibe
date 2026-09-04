#!/usr/bin/env node
/**
 * vibe CLI — verdicts, records, tokens. Skills call this from the shell.
 * Every command accepts --json. The exit code is the verdict (errors.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { runChecks } from './core/check.js';
import { detectClient, detectModel } from './core/client.js';
import { irreversibleNeedsToken, parseTokenPolicy, readConfig, writeConfig } from './core/config.js';
import { denied, usage, VibeError } from './core/errors.js';
import { answer, ask, openQuestions, resolve as resolveQuestion } from './core/inbox.js';
import { abandon, approve, draft, intentPath, loadScenarios } from './core/intent.js';
import { addKnowledge } from './core/knowledge.js';
import { compare, EDGE_TYPES, readEdges, readLedger, record, why, type CompareBy, type CompareMetric, type EdgeType } from './core/ledger.js';
import { findProjectRoot, vibePath } from './core/paths.js';
import { listRegressions, recordRegression } from './core/regress.js';
import { profileFile } from './core/profile.js';
import { readDocument } from './core/docs/read.js';
import { research, SOURCES, type Source } from './core/research.js';
import { addSkill, createSkill, dismissProposal, listSkills, markUsed, pruneSkills, suggestSkills } from './core/skills.js';
import { graphMermaid, type CheckType } from './core/scenarios.js';
import { readState } from './core/state.js';
import { readJson, readText } from './core/store.js';
import { verifyAndConsume } from './core/tokens.js';
import { buildStateView } from './core/view.js';
import { installPlugin, pluginStatus } from './install/plugin.js';
import { checkPluginTree, writePluginTree } from './install/tree.js';
import { checkUpdate, runUpdate } from './install/update.js';
import { buildMcpb } from './install/mcpb.js';
import { spawnSync } from 'node:child_process';
import { ensureGlobal, globalStatus, uninstallGlobal, uninstallProjectSurfaces } from './install/global.js';
import { ensureProject, projectStatus, purgeProject } from './install/project.js';

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

const HELP = `vibe — an AX/FDE harness. The harness judges; a human approves.

  setup     update [--check] · status · tokens [strict|irreversible|off] · uninstall [--purge-state]   (card, skills and hook live in ~/.claude and ~/.codex;
            npm i -g puts them there and any vibe command repairs them; uninstall also clears what an older init left in the project)
            plugin build [--check] (manifests from package.json) · plugin mcpb [--out vibe.mcpb] (Claude desktop app bundle) · plugin install | status [--home <dir>]
  work      state [--graph] · read <file> [--sheet] [--pages] (xlsx·docx·pptx·pdf·tables) · profile <file> [--sheet] (csv·tsv·jsonl·json·xlsx) · intent draft <intent.md> <scenarios.yaml> | --stdin · intent show
            approve [token] · check [id…] [--all] · evidence [run] · abandon --reason "…"
  checks    run (exit code) · file (exists·pattern·contains·schema·sum) · http (status·schema·maxMs) · eval (matching cases ≥ expect.pass) · human (inbox, no verdict)
  human     ask "question" [--options "a|b"] [--default a] [--needs approve|authorize:<action>] [--target "…"]
            authorize <token> --action push|deploy|send|delete|spend [--target "…"] · inbox [list|answer <id> "text"|resolve <id>]
  memory    regress record --scenario <id> --title "…" [--check-from-evidence <run>] · regress list
            knowledge add <file|--stdin> --title "…"
  research  research --from-intent | "query" [--sources repos,code,skills] [--max 5]   (GitHub · skill catalogs · 24h cache)
  skills    skill suggest [--all] · skill create <name> --check run|file|http|eval [--from-scenario <id>]
            skill add owner/repo[@name] [--pin <sha>] [--yes] · skill search <keyword> · skill list
            skill used <name> · skill prune [--unused-runs 10] [--dry-run] · skill dismiss <ref>
  ledger    ledger [--since 7d] · ledger compare --by client|model|harness --metric checks|turns|cost [--min-runs 5] [--ledger <file>]
            ledger why <node> [--depth 3] · ledger edges [--type supersedes|decided-by|implements|caused]

A scenario may declare needs: [ids] — independent scenarios are checked in parallel, dependents after their parents pass.

Every command accepts --json. Exit codes: 0 ok · 1 verdict failed · 2 usage · 3 token · 4 invalid transition
`;

interface Output {
  json: unknown;
  text: string;
  code: number;
}

function readStdin(): string {
  return fs.readFileSync(0, 'utf-8');
}

function parseSince(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+)([dhm])$/.exec(value);
  if (!match) throw usage('--since takes forms like 7d · 12h · 30m');
  const n = Number(match[1]);
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2] as 'd' | 'h' | 'm'];
  return n * unit;
}

// ─── Commands ───────────────────────────────────────────────────────

function cmdTokens(root: string, policyRaw: string | undefined): Output {
  if (policyRaw) {
    ensureProject(root);
    writeConfig(root, { tokens: parseTokenPolicy(policyRaw) });
  }
  const policy = readConfig(root).tokens;
  return { json: { tokens: policy }, text: `tokens: ${policy}`, code: 0 };
}

function cmdStatus(root: string, flags: Flags): Output {
  const g = globalStatus(flagString(flags, 'home'));
  const p = projectStatus(root);
  const update = process.env['VIBE_OFFLINE'] ? { installed: packageVersion(), latest: null, available: false } : checkUpdate();
  const lines = [
    `vibe ${packageVersion()} — ${g.home}`,
    ...Object.entries(g.clients).map(([client, c]) => `  ${client.padEnd(9)} ${c.mode === 'plugin' ? `plugin ${c.pluginVersion ?? 'not installed'}` : `home · card ${c.card ? 'ok' : '-'} · skills ${c.skills} · hook ${c.hook ? 'ok' : '-'}`}${c.current ? '' : ' — stale; any vibe command repairs it'}`),
    `  card      ${g.cardBytes} bytes${g.cardOver ? ' — over 1KB!' : ''}`,
    ...(update.available ? [`  update    ${update.latest} available — \`vibe update\``] : []),
    `project   ${p.root}`,
    `  .vibe     ${p.vibe ? 'ok' : 'none yet — the first record creates it'}`,
    `  state     ${p.state}`,
    `  inbox     ${p.inboxOpen} open`,
  ];
  return { json: { version: packageVersion(), ...g, project: p, update }, text: lines.join('\n'), code: 0 };
}

function cmdUpdate(flags: Flags): Output {
  if (flags['check'] === true) {
    const c = checkUpdate();
    const text = c.latest === null ? `installed ${c.installed} · registry unreachable` : c.available ? `${c.installed} → ${c.latest} available — run \`vibe update\`` : `${c.installed} is current`;
    return { json: c, text, code: 0 };
  }
  const r = runUpdate();
  if (!r.updated) return { json: r, text: r.detail, code: r.latest === null ? 2 : 0 };
  // The new binary registers the plugins itself; run it once so the report shows the new state.
  const after = spawnSync('vibe', ['status'], { encoding: 'utf-8', timeout: 120_000, shell: process.platform === 'win32' });
  const tail = after.status === 0 ? after.stdout.trim() : `run \`vibe status\` to finish the setup`;
  return { json: { ...r, status: after.stdout }, text: `updated ${r.detail}\n${tail}`, code: 0 };
}

function cmdUninstall(root: string, flags: Flags): Output {
  const home = uninstallGlobal(flagString(flags, 'home'));
  const project = uninstallProjectSurfaces(root);
  if (flags['purge-state'] === true && purgeProject(root)) project.push('.vibe/');
  const removed = [...home, ...project.map((r) => path.join(path.relative(process.cwd(), root) || '.', r))];
  return { json: { removed, home, project, root }, text: removed.length ? `removed: ${removed.join(', ')}` : 'nothing to remove', code: 0 };
}

function cmdPlugin(sub: string | undefined, flags: Flags): Output {
  const home = flagString(flags, 'home');
  if (sub === 'mcpb') {
    const r = buildMcpb(flagString(flags, 'out') ?? 'vibe.mcpb');
    return { json: r, text: `${r.file} · ${r.bytes} bytes · vibe ${r.version}\n  open it in the Claude desktop app (macOS · Windows), pick the project folder; the app needs the vibe CLI: npm i -g @su-record/vibe`, code: 0 };
  }
  if (sub === 'build') {
    if (flags['check'] === true) {
      const drift = checkPluginTree();
      return { json: { drift }, text: drift.length ? `plugin tree drift — run \`vibe plugin build\`:\n  ${drift.join('\n  ')}` : 'plugin tree matches package.json', code: drift.length ? 1 : 0 };
    }
    const written = writePluginTree();
    return { json: { written }, text: written.length ? `wrote ${written.join(', ')}` : 'plugin tree already current', code: 0 };
  }
  if (sub === 'install') {
    const r = installPlugin(home);
    const text = [
      `plugin ${r.version} → ${r.tree}`,
      `  files       ${r.files.join(', ')}`,
      `  marketplace ${r.marketplace}`,
      '  next:',
      ...r.next.map((n) => `    ${n}`),
    ].join('\n');
    return { json: r, text, code: 0 };
  }
  if (sub === 'status') {
    const r = pluginStatus(home);
    const text = [
      `plugin tree ${r.exists ? 'ok' : 'missing'} — ${r.tree}`,
      `  manifest ${r.manifestVersion ?? '-'} · package ${r.packageVersion} · skills ${r.skills} · hooks ${r.hooks ? 'ok' : '-'} · registered ${r.registered ? 'yes' : 'no'}`,
      ...(r.drift.length ? r.drift.map((d) => `  drift: ${d}`) : ['  no drift']),
    ].join('\n');
    return { json: r, text, code: r.drift.length ? 1 : 0 };
  }
  throw usage('plugin build [--check] | plugin mcpb [--out vibe.mcpb] | plugin install | plugin status [--home <dir>]');
}

const GLYPH: Record<string, string> = { pass: '✔', fail: '✘', pending: '?', blocked: '⊘', never: '·' };

function cmdState(root: string, flags: Flags): Output {
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

async function cmdResearch(root: string, sub: string | undefined, flags: Flags): Promise<Output> {
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

async function cmdSkill(root: string, sub: string | undefined, args: string[], flags: Flags): Promise<Output> {
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

function cmdRead(root: string, file: string | undefined, flags: Flags): Output {
  if (!file) throw usage('read <file.xlsx|docx|pptx|pdf|csv|…> [--sheet name] [--pages A-B]');
  const options: Parameters<typeof readDocument>[2] = {};
  const sheet = flagString(flags, 'sheet');
  const pages = flagString(flags, 'pages');
  if (sheet) options.sheet = sheet;
  if (pages) options.pages = pages;
  const d = readDocument(root, file, options);
  return { json: d, text: `${d.file} · ${d.format} · read by ${d.method} · ${d.sections.length} section(s)${d.truncated ? ' · truncated' : ''}\n\n${d.text}`, code: 0 };
}

function cmdProfile(root: string, file: string | undefined, flags: Flags): Output {
  if (!file) throw usage('profile <file.csv|tsv|jsonl|json|xlsx> [--sheet name]');
  const p = profileFile(root, file, flagString(flags, 'sheet'));
  const lines = [
    `${p.file} · ${p.format} · ${p.rows} rows · ${p.columns.length} columns · ${p.duplicateRows} duplicate rows`,
    ...p.anomalies.map((a) => `  ! ${a}`),
    ...p.columns.map((c) => `  ${c.name || '(no header)'} ${c.type}${c.missing ? ` · missing ${c.missing}` : ''} · distinct ${c.distinct}${c.min !== undefined ? ` · ${c.min}…${c.max}` : ''} · e.g. ${c.sample.map((s) => JSON.stringify(s)).join(', ')}`),
  ];
  return { json: p, text: lines.join('\n'), code: 0 };
}

function cmdIntent(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
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

function cmdApprove(root: string, args: string[]): Output {
  ensureProject(root);
  const token = args.join(' ') || null;
  const result = approve(root, token);
  return { json: { ok: true, ...result, state: 'APPROVED' }, text: `APPROVED · ${result.hash} (by ${result.basis})`, code: 0 };
}

async function cmdCheck(root: string, args: string[], flags: Flags): Promise<Output> {
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

function cmdEvidence(root: string, args: string[]): Output {
  const dir = vibePath(root, 'evidence');
  const runId = args[0] ?? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort((a, b) => Number(a.slice(2, -5)) - Number(b.slice(2, -5))).at(-1)?.replace('.json', '') : undefined);
  if (!runId) throw usage('no evidence yet');
  const evidence = readJson<unknown>(path.join(dir, `${runId}.json`));
  if (!evidence) throw usage(`no such run: ${runId}`);
  return { json: evidence, text: JSON.stringify(evidence, null, 2), code: 0 };
}

function cmdAbandon(root: string, flags: Flags): Output {
  ensureProject(root);
  abandon(root, flagString(flags, 'reason') ?? '');
  return { json: { state: 'ABANDONED' }, text: 'ABANDONED', code: 0 };
}

function cmdAsk(root: string, args: string[], flags: Flags): Output {
  ensureProject(root);
  const question = args.join(' ');
  if (!question) throw usage('ask "question"');
  const options = flagString(flags, 'options')?.split('|').map((s) => s.trim()).filter(Boolean);
  const needsRaw = flagString(flags, 'needs');
  let needs: { kind: 'approve' | 'authorize'; target: string } | undefined;
  const policy = readConfig(root).tokens;
  if (needsRaw === 'approve') {
    const state = readState(root);
    if (state.state !== 'DRAFT' || !state.intentHash) throw denied('an approval token can only be issued in DRAFT');
    if (policy === 'strict') needs = { kind: 'approve', target: state.intentHash };
  } else if (needsRaw?.startsWith('authorize:')) {
    const action = needsRaw.slice('authorize:'.length);
    if (irreversibleNeedsToken(policy)) needs = { kind: 'authorize', target: `${action}:${flagString(flags, 'target') ?? ''}` };
  } else if (needsRaw) {
    throw usage('--needs takes approve or authorize:<action>');
  }
  const input: Parameters<typeof ask>[1] = { question };
  if (options && options.length) input.options = options;
  const def = flagString(flags, 'default');
  if (def) input.default = def;
  if (needs) input.needs = needs;
  const result = ask(root, input);
  record(root, { event: 'ask', client: detectClient(), model: detectModel(), detail: question.slice(0, 120) });
  const text = [
    `question recorded [${result.id}]`,
    ...(result.token ? [`token: ${result.token} (valid until ${result.expiresAt}) — the user must paste it back in chat before anything proceeds`] : []),
    ...(needsRaw && !result.token ? [`tokens: ${policy} — no token needed; proceed when the user says yes`] : []),
  ].join('\n');
  return { json: { ...result, policy }, text, code: 0 };
}

function cmdAuthorize(root: string, args: string[], flags: Flags): Output {
  ensureProject(root);
  const token = args.join(' ') || null;
  const action = flagString(flags, 'action');
  if (!action) throw usage('authorize [token] --action push|deploy|send|delete|spend [--target "…"]');
  const target = `${action}:${flagString(flags, 'target') ?? ''}`;
  const policy = readConfig(root).tokens;
  let basis: 'token' | 'auto' = 'auto';
  if (irreversibleNeedsToken(policy)) {
    if (!token) throw denied(`"${action}" needs a human token here (tokens: ${policy})`);
    const verdict = verifyAndConsume(root, 'authorize', target, token);
    if (!verdict.ok) throw denied(verdict.reason);
    basis = 'token';
  }
  record(root, { event: 'authorize', client: detectClient(), model: detectModel(), detail: `${target} by ${basis}` });
  return { json: { ok: true, action, target, basis }, text: `authorized: ${target} (by ${basis})`, code: 0 };
}

function cmdInbox(root: string, sub: string | undefined, args: string[]): Output {
  if (sub === 'answer') {
    const [id, ...rest] = args;
    if (!id || rest.length === 0) throw usage('inbox answer <id> "text"');
    if (!answer(root, id, rest.join(' '))) throw usage(`no such question: ${id}`);
    return { json: { ok: true }, text: `answered ${id}`, code: 0 };
  }
  if (sub === 'resolve') {
    const [id] = args;
    if (!id) throw usage('inbox resolve <id>');
    if (!resolveQuestion(root, id)) throw usage(`no such question: ${id}`);
    return { json: { ok: true }, text: `resolved ${id}`, code: 0 };
  }
  const open = openQuestions(root);
  return { json: open, text: open.length ? open.map((q) => `[${q.id}] ${q.question}${q.options ? ` (${q.options.join(' | ')})` : ''}${q.answer ? `\n    answer: ${q.answer}` : ''}`).join('\n') : 'inbox is empty', code: 0 };
}

function cmdRegress(root: string, sub: string | undefined, flags: Flags): Output {
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

function cmdKnowledge(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
  ensureProject(root);
  if (sub !== 'add') throw usage('knowledge add <file|--stdin> --title "…"');
  const title = flagString(flags, 'title') ?? '';
  const body = flags['stdin'] === true ? readStdin() : args[0] ? readText(path.resolve(root, args[0])) ?? '' : '';
  const result = addKnowledge(root, title, body);
  return { json: result, text: `knowledge → ${path.relative(root, result.file)}`, code: 0 };
}

function cmdLedger(root: string, sub: string | undefined, args: string[], flags: Flags): Output {
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

// ─── Dispatch ───────────────────────────────────────────────────────

function packageVersion(): string {
  return readJson<{ version: string }>(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json'))?.version ?? 'unknown';
}

export async function dispatch(argv: string[]): Promise<Output> {
  const { positionals, flags } = parseArgs(argv);
  const [cmd, sub, ...rest] = positionals;
  if (cmd === 'version' || flags['version'] === true) return { json: { version: packageVersion() }, text: packageVersion(), code: 0 };
  if (!cmd || flags['help'] === true) return { json: { help: HELP }, text: HELP, code: 0 };
  const repaired = process.env['VIBE_SKIP_SETUP'] || cmd === 'uninstall' ? [] : ensureGlobal(flagString(flags, 'home'));
  if (repaired.length > 0) {
    const modes = globalStatus(flagString(flags, 'home')).clients;
    process.stderr.write(`[vibe] set up ${repaired.map((c) => `${c} (${modes[c]?.mode === 'plugin' ? `plugin ${modes[c]?.pluginVersion ?? ''}`.trim() : 'card, skills, hook in home'})`).join(', ')}\n`);
  }
  const root = cmd === 'plugin' ? process.cwd() : findProjectRoot();
  const tail = [sub, ...rest].filter((s): s is string => Boolean(s));
  switch (cmd) {
    case 'status':
      return cmdStatus(root, flags);
    case 'update':
      return cmdUpdate(flags);
    case 'tokens':
      return cmdTokens(root, sub);
    case 'uninstall':
      return cmdUninstall(root, flags);
    case 'plugin':
      return cmdPlugin(sub, flags);
    case 'state':
      return cmdState(root, flags);
    case 'profile':
      return cmdProfile(root, sub, flags);
    case 'read':
      return cmdRead(root, sub, flags);
    case 'intent':
      return cmdIntent(root, sub, rest, flags);
    case 'approve':
      return cmdApprove(root, tail);
    case 'check':
      return cmdCheck(root, tail, flags);
    case 'evidence':
      return cmdEvidence(root, tail);
    case 'abandon':
      return cmdAbandon(root, flags);
    case 'ask':
      return cmdAsk(root, tail, flags);
    case 'authorize':
      return cmdAuthorize(root, tail, flags);
    case 'inbox':
      return cmdInbox(root, sub, rest);
    case 'regress':
      return cmdRegress(root, sub, flags);
    case 'knowledge':
      return cmdKnowledge(root, sub, rest, flags);
    case 'ledger':
      return cmdLedger(root, sub, rest, flags);
    case 'research':
      return cmdResearch(root, sub, flags);
    case 'skill':
      return cmdSkill(root, sub, rest, flags);
    default:
      throw usage(`unknown command: ${cmd}\n${HELP}`);
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

/** A global install runs this file through a `bin/vibe` symlink, so compare real paths, not argv as given. */
function invokedDirectly(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const real = (p: string): string => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  return real(argv1) === real(new URL(import.meta.url).pathname);
}
if (invokedDirectly()) void main();
