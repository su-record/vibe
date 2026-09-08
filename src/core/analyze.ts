import { intentPath, loadScenarios } from './intent.js';
import type { Scenario } from './scenarios.js';
import { readText } from './store.js';

/**
 * `vibe intent analyze` — a read-only consistency check between the intent's promises and the
 * scenarios bound to check them. It changes nothing: a bullet with no scenario is `uncovered`, a
 * scenario that answers no bullet is `unrequested`, and a `human` check standing for a bullet that
 * names a file or a command is `weak` — a claim with no machine verdict behind it.
 */
const STOP_TERMS = new Set(['then', 'with', 'that', 'this', 'from', 'into', 'have', 'will', 'only', 'when', 'also', 'every', 'which', 'their', 'there', 'these', 'those', 'should', 'would', 'could', 'about', 'being', 'after', 'before']);

interface Tokens {
  terms: Set<string>;
  backticks: Set<string>;
}

function tokenize(text: string): Tokens {
  const backticks = new Set<string>();
  for (const m of text.matchAll(/`([^`]+)`/g)) backticks.add(m[1]!.toLowerCase());
  const terms = new Set<string>(backticks);
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []) if (!STOP_TERMS.has(w)) terms.add(w);
  return { terms, backticks };
}

/** Bullets under the intent's "## What counts as success" section, one per `- ` line, up to the next top-level heading. */
function successBullets(intentText: string): string[] {
  const lines = intentText.split('\n');
  const start = lines.findIndex((l) => /^##\s+What counts as success/i.test(l.trim()));
  if (start === -1) return [];
  const bullets: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^##\s+\S/.test(line.trim())) break;
    const m = /^-\s+(.*)$/.exec(line.trim());
    if (m) bullets.push(m[1]!.trim());
  }
  return bullets;
}

/** A backticked path (has a slash) or command (has a space), or a bare filename with an extension. */
function namesFileOrCommand(text: string): boolean {
  if (/`[^`]*[/ ][^`]*`/.test(text)) return true;
  return /\b[\w./-]+\.[a-z]{1,5}\b/.test(text);
}

export interface BulletCoverage {
  bullet: string;
  excerpt: string;
  scenarios: string[];
  status: 'covered' | 'uncovered' | 'weak';
}
export interface Analysis {
  bullets: BulletCoverage[];
  unrequested: string[];
  verdict: { covered: number; total: number; uncovered: number; unrequested: number; weak: number };
}

interface ScenarioTerms {
  scenario: Scenario;
  terms: Set<string>;
}

/** Scenarios sharing ≥ 2 terms with the bullet, or 1 shared term that came from a backticked name. */
function coveringScenarios(bullet: Tokens, scenarios: ScenarioTerms[]): Scenario[] {
  const out: Scenario[] = [];
  for (const { scenario, terms } of scenarios) {
    const shared = [...bullet.terms].filter((t) => terms.has(t));
    if (shared.length >= 2 || (shared.length === 1 && bullet.backticks.has(shared[0]!))) out.push(scenario);
  }
  return out;
}

function excerptOf(text: string): string {
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export function analyzeIntent(root: string): Analysis {
  const intentText = readText(intentPath(root)) ?? '';
  const scenarios = loadScenarios(root);
  const scenarioTerms: ScenarioTerms[] = scenarios.map((s) => ({ scenario: s, terms: tokenize(`${s.then} ${s.id}`).terms }));
  const bulletData = successBullets(intentText).map((text) => ({ text, tokens: tokenize(text) }));

  const bullets: BulletCoverage[] = bulletData.map(({ text, tokens }) => {
    const covering = coveringScenarios(tokens, scenarioTerms);
    const weak = covering.length > 0 && namesFileOrCommand(text) && covering.some((s) => s.check.type === 'human');
    const status: BulletCoverage['status'] = covering.length === 0 ? 'uncovered' : weak ? 'weak' : 'covered';
    return { bullet: text, excerpt: excerptOf(text), scenarios: covering.map((s) => s.id), status };
  });

  const unrequested = scenarioTerms
    .filter(({ terms }) => !bulletData.some(({ tokens }) => [...tokens.terms].some((t) => terms.has(t))))
    .map(({ scenario }) => scenario.id);

  const covered = bullets.filter((b) => b.status === 'covered').length;
  const uncovered = bullets.filter((b) => b.status === 'uncovered').length;
  const weak = bullets.filter((b) => b.status === 'weak').length;
  return { bullets, unrequested, verdict: { covered, total: bullets.length, uncovered, unrequested: unrequested.length, weak } };
}

const STATUS_MARK: Record<BulletCoverage['status'], string> = { covered: '✔ covered', uncovered: '✘ uncovered', weak: '! weak' };

export function renderAnalysis(a: Analysis): string {
  const rows = a.bullets.map((b) => `${STATUS_MARK[b.status].padEnd(11)} ${(b.scenarios.join(',') || '-').padEnd(20)} ${b.excerpt}`);
  const unrequestedRows = a.unrequested.map((id) => `unrequested ${id}`);
  const verdict = `covered ${a.verdict.covered}/${a.verdict.total} · uncovered ${a.verdict.uncovered} · unrequested ${a.verdict.unrequested} · weak ${a.verdict.weak}`;
  return ['status      scenarios            bullet', ...rows, ...unrequestedRows, verdict].join('\n');
}
