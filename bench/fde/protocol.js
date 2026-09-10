import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileHash, digest } from './evidence.js';
import { treeManifest } from '../snapshot.js';

export const ID = 'fde-discovery-v1';
export const ARMS = ['off', 'scoped-4.1.25', 'scoped-4.1.26'];
export const CLIENTS = ['claude', 'codex'];
export const VARIANTS = ['status-first', 'followup-first'];
export const BASELINE = '2d2af57';
export const TARGETS = { scopeFloor: 0.9, groundedFamilies: 3, weightedInputRatio: 0.8, criticalOmissions: 0, unsupportedAssertions: 0 };
export const ASSESSMENT_LIMITATION = 'These indicators do not measure the appropriateness of problem framing or tradeoff judgment.';
export const ASSESSMENT = { kind: 'deterministic', indicators: ['mechanicalCoverage', 'criticalOmissions', 'unsupportedAssertions', 'groundedOpportunities', 'pilot', 'sourcePreserved'],
  humanReview: 'optional-diagnostic', assertions: 'structured-only', limitation: ASSESSMENT_LIMITATION };
export const SETTINGS = { claude: { model: 'claude-opus-5', effort: null }, codex: { model: 'gpt-5.6-terra', effort: 'xhigh' } };
export const BUDGET = { rawTokens: 60000000, usd: null, wallMs: 86400000, unknownMoneyAccepted: true };
export const LIMITS = { sessions: 6, clarificationRounds: 2, scopeCorrections: 1, sessionMs: 900000, attemptMs: 3600000, concurrencyPerClient: 1 };

export function clientVersions() {
  return Object.fromEntries(CLIENTS.map((client) => {
    try { return [client, execFileSync(client, ['--version'], { encoding: 'utf8', timeout: 15000, shell: process.platform === 'win32' }).trim()]; }
    catch { return [client, null]; }
  }));
}

export function productHash(repo) {
  return digest(['dist', 'skills', 'hooks'].map((dir) => [dir, treeManifest(path.join(repo, dir))])
    .concat(['card.md', 'package.json'].map((file) => [file, fileHash(path.join(repo, file))])));
}

export function validateProducts(protocol, repo, baseline) {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: baseline, encoding: 'utf8' }).trim();
  if (!revision.startsWith(BASELINE)) throw new Error('baseline checkout is not the pinned 4.1.25 revision');
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: baseline, encoding: 'utf8' }).trim()) throw new Error('baseline product has tracked edits');
  validateCandidate(protocol, repo);
  for (const [arm, directory, version] of [['baseline', baseline, '4.1.25'], ['candidate', repo, '4.1.26']]) {
    if (JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).version !== version) throw new Error(`${arm} version mismatch`);
    if (productHash(directory) !== protocol.products?.[arm]) throw new Error(`${arm} executable/card/skill/hook hash changed or was not frozen`);
  }
}

export function validateCandidate(protocol, repo) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  if (git('rev-parse', 'HEAD') !== protocol.candidateRevision) throw new Error('candidate checkout does not match the measured/CI revision');
  const changed = [...git('diff', 'HEAD', '--name-only').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')];
  const runtime = /^(?:\.vibe\/(?:state\.json|results\.json|snapshot\.json|ledger\.jsonl|inbox\.jsonl|evidence\/r-\d+\.json|metrics\/current-run\.jsonl?)|bench\/claims\/4\.1\.26\/.*)$/;
  if (changed.some((file) => file && !runtime.test(file))) throw new Error('candidate source has edits outside generated verification/cohort evidence');
  if (productHash(repo) !== protocol.products?.candidate) throw new Error('candidate executable product differs from frozen evidence');
}

export function schedule() {
  const rows = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const client of CLIENTS) for (const variant of VARIANTS) {
      const ordered = ARMS.map((_, offset) => ARMS[(offset + attempt) % ARMS.length]);
      for (const arm of ordered) rows.push({ id: `${client}/${variant}/${arm}/${attempt + 1}`, client, variant, arm, attempt: attempt + 1 });
    }
  }
  return rows;
}

export function codePins(repo, task) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const tracked = git('ls-files').split('\n');
  const runner = tracked.filter((file) => file.startsWith('bench/') && !file.startsWith('bench/tasks/') && !file.startsWith('bench/claims/') && !file.endsWith('.jsonl'));
  return { revision: git('rev-parse', 'HEAD'), runner: digest(runner.map((file) => ({ path: file, sha256: fileHash(path.join(repo, file)) }))),
    fixture: digest(treeManifest(task)), rubric: fileHash(path.join(task, 'key/requirements.json')) };
}

export function settingsFromSources(env, home) {
  const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const codexPath = path.join(home, '.codex/config.toml');
  const claudePath = path.join(home, '.claude/settings.json');
  const codex = read(codexPath);
  let claude = {};
  try { claude = JSON.parse(read(claudePath) || '{}'); } catch { throw new Error('configured Claude settings are invalid JSON'); }
  const pick = (names, value, source) => {
    const key = names.find((name) => env[name]);
    return key ? { value: env[key], source: `env:${key}` } : { value: value ?? null, source };
  };
  return {
    codex: { model: pick(['VIBE_BENCH_CODEX_MODEL', 'CODEX_MODEL'], /^model\s*=\s*"([^"]+)"/m.exec(codex)?.[1], codexPath),
      effort: pick(['VIBE_BENCH_CODEX_EFFORT'], /^model_reasoning_effort\s*=\s*"([^"]+)"/m.exec(codex)?.[1], codexPath) },
    claude: { model: pick(['VIBE_BENCH_CLAUDE_MODEL', 'ANTHROPIC_MODEL', 'CLAUDE_MODEL'], claude.model, claudePath),
      effort: pick(['VIBE_BENCH_CLAUDE_EFFORT', 'CLAUDE_CODE_EFFORT_LEVEL'], claude.effortLevel, claudePath) },
  };
}

/** A proposal is intentionally unable to authorize itself. Freeze after settings and budgets are confirmed. */
export function protocolDraft(repo, task, sourceSettings) {
  return { id: ID, status: 'draft', createdAt: new Date().toISOString(), pins: codePins(repo, task),
    clientVersions: clientVersions(), nodeVersion: process.version,
    baselineRevision: BASELINE, candidateRevision: null, products: { baseline: null, candidate: null }, targets: TARGETS, schedule: schedule(),
    settings: Object.fromEntries(CLIENTS.map((client) => [client, { model: sourceSettings[client].model.value, effort: sourceSettings[client].effort.value,
      sources: sourceSettings[client], maxTurns: client === 'claude' ? 40 : null, turnLimit: client === 'claude' ? 'client-enforced' : 'unavailable-use-shared-time-limit' }])),
    limits: { ...LIMITS }, diagnostics: { enabled: false, directory: null },
    budget: { ...BUDGET, note: 'Accounting is observed at client-result boundaries. One in-flight invocation may overshoot; missing usage stops further calls.' },
    prices: {}, assessment: ASSESSMENT,
    task: 'work-opportunities', limitations: [ASSESSMENT_LIMITATION, 'Synthetic discovery case; no ROI, human-time-saving, broad prevention or general FDE claim.'],
  };
}

export function protocolErrors(protocol, { frozen = true } = {}) {
  const errors = [];
  if (protocol.id !== ID) errors.push('wrong protocol id');
  const planned = protocol.schedule?.map(({ id, client, variant, arm, attempt }) => ({ id, client, variant, arm, attempt }));
  if (JSON.stringify(planned) !== JSON.stringify(schedule())) errors.push('the 60 planned cells/order changed');
  if (JSON.stringify(protocol.targets) !== JSON.stringify(TARGETS)) errors.push('release targets changed');
  if (JSON.stringify(protocol.assessment) !== JSON.stringify(ASSESSMENT)) errors.push('deterministic assessment policy changed or missing');
  if (!protocol.baselineRevision?.startsWith(BASELINE)) errors.push('baseline must be pinned 4.1.25');
  for (const [key, value] of Object.entries(LIMITS)) if (protocol.limits?.[key] !== value) errors.push(`${key}: approved execution limit changed or missing`);
  const diagnostics = protocol.diagnostics;
  if (typeof diagnostics?.enabled !== 'boolean' || (diagnostics.enabled ? typeof diagnostics.directory !== 'string' || !path.isAbsolute(diagnostics.directory) : diagnostics.directory !== null)) errors.push('explicit private diagnostics policy missing or invalid');
  for (const client of CLIENTS) {
    const setting = protocol.settings?.[client];
    for (const key of ['model', 'effort']) {
      if (setting?.[key] !== SETTINGS[client][key]) errors.push(`${client}: ${key} differs from the approved setting`);
      if (!setting?.sources?.[key]?.source || setting.sources[key].value !== setting[key]) errors.push(`${client}: missing or mismatched ${key} provenance`);
    }
    if (client === 'claude' && (setting?.maxTurns !== 40 || setting?.turnLimit !== 'client-enforced')) errors.push('claude: approved 40-turn cap changed');
    if (client === 'codex' && (setting?.maxTurns !== null || setting?.turnLimit !== 'unavailable-use-shared-time-limit')) errors.push('codex: unavailable turn cap must be explicit; shared wall limits still apply');
  }
  if (frozen) {
    if (CLIENTS.some((client) => !protocol.clientVersions?.[client]) || !protocol.nodeVersion) errors.push('client/runtime versions must be frozen');
    if (protocol.status !== 'frozen' || !/^[a-f0-9]{40}$/.test(protocol.candidateRevision ?? '')) errors.push('protocol/candidate not frozen');
    for (const field of ['runner', 'fixture', 'rubric']) if (!/^[a-f0-9]{64}$/.test(protocol.pins?.[field] ?? '')) errors.push(`missing ${field} hash`);
    for (const arm of ['baseline', 'candidate']) if (!/^[a-f0-9]{64}$/.test(protocol.products?.[arm] ?? '')) errors.push(`missing ${arm} executable hash`);
    for (const [key, value] of Object.entries(BUDGET)) if (protocol.budget?.[key] !== value) errors.push(`${key}: approved resource budget changed or missing`);
    for (const [model, price] of Object.entries(protocol.prices ?? {})) if (Object.values(price).some((n) => !Number.isFinite(n) || n < 0)) errors.push(`${model}: invalid configured price`);
  }
  return errors;
}

export function authorize(protocol, approval) {
  const errors = protocolErrors(protocol);
  if (!approval?.approvedBy || !approval?.approvedAt || approval.protocolHash !== digest(protocol) || approval.action !== 'run-60-planned-attempts') errors.push('separate human authorization for this exact protocol is missing');
  if (errors.length) throw new Error(errors.join('; '));
}
