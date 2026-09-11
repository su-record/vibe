import { usage } from './errors.js';
import { vibePath } from './paths.js';
import { readJson, writeJson } from './store.js';

/**
 * Project policy. The verdict (DONE only via `check`) is not configurable — it is a fact, not a
 * permission. Who may authorize is the user's call, so tokens are a policy:
 *   strict        approval and irreversible actions both need a human token
 *   irreversible  approval passes on a plain `vibe approve` (recorded as "by chat"); irreversible actions need a token
 *   off           no tokens; everything is recorded as "auto" (for users who already skip permissions)
 */
export type TokenPolicy = 'strict' | 'irreversible' | 'off';
export const TOKEN_POLICIES: ReadonlyArray<TokenPolicy> = ['strict', 'irreversible', 'off'];
/** `off` by default, by the user's decision: a plain "yes" approves and the hook only warns before an irreversible command; `irreversible` and `strict` are opt-in. */
export const DEFAULT_TOKEN_POLICY: TokenPolicy = 'off';

export const DEFAULT_CATALOGS: readonly string[] = ['anthropics/skills', 'vercel-labs/agent-skills', 'NousResearch/hermes-agent'];

/** Which model a role runs at, and at what reasoning effort — names the client understands; vibe keeps no catalogue. */
export interface ModelChoice {
  model?: string;
  effort?: string;
}

export interface Config {
  tokens: TokenPolicy;
  /** GitHub repositories whose `skills/` (or root) directories are searched as skill catalogs. */
  catalogs: string[];
  /** A stateless reader command for `vibe read --ask` (stdin → stdout); unset means the client CLI on PATH. */
  reader?: string;
  /** The reader's model and effort on the client CLI (`reader: { model, effort }` in config.json). */
  readerModel?: ModelChoice;
  /** The reviewers' model and effort on the client CLI (`reviewer: { model, effort }` in config.json). */
  reviewerModel?: ModelChoice;
}

function choice(raw: unknown): ModelChoice | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const out: ModelChoice = {};
  if (typeof r['model'] === 'string' && r['model'].trim()) out.model = r['model'].trim();
  if (typeof r['effort'] === 'string' && r['effort'].trim()) out.effort = r['effort'].trim();
  return out.model || out.effort ? out : undefined;
}

/** The choice for a role: the environment for one run, else the project config, else nothing (the driver's defaults). */
export function roleChoice(root: string, role: 'reader' | 'reviewer', cfg: Config = readConfig(root)): ModelChoice {
  const base = (role === 'reader' ? cfg.readerModel : cfg.reviewerModel) ?? {};
  const env = (key: string): string | undefined => process.env[key]?.trim() || undefined;
  const prefix = role === 'reader' ? 'VIBE_READER' : 'VIBE_REVIEWER';
  const out: ModelChoice = {};
  const model = env(`${prefix}_MODEL`) ?? base.model;
  const effort = env(`${prefix}_EFFORT`) ?? base.effort;
  if (model) out.model = model;
  if (effort) out.effort = effort;
  return out;
}

export function configPath(root: string): string {
  return vibePath(root, 'config.json');
}

export function readConfig(root: string): Config {
  return configFromRaw(readJson<unknown>(configPath(root)));
}

export function configFromRaw(value: unknown): Config {
  const raw = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Partial<Config>;
  const tokens = TOKEN_POLICIES.includes(raw.tokens as TokenPolicy) ? (raw.tokens as TokenPolicy) : DEFAULT_TOKEN_POLICY;
  const catalogs = Array.isArray(raw.catalogs) ? raw.catalogs.filter((c): c is string => typeof c === 'string' && /^[\w.-]+\/[\w.-]+$/.test(c)) : [...DEFAULT_CATALOGS];
  const raw2 = raw as Record<string, unknown>;
  const out: Config = { tokens, catalogs };
  if (typeof raw2['reader'] === 'string' && raw2['reader'].trim()) out.reader = raw2['reader'].trim();
  const readerModel = choice(raw2['reader']);
  if (readerModel) out.readerModel = readerModel;
  const reviewerModel = choice(raw2['reviewer']);
  if (reviewerModel) out.reviewerModel = reviewerModel;
  return out;
}

export function writeConfig(root: string, config: Partial<Config>): void {
  writeJson(configPath(root), { ...readConfig(root), ...config });
}

export function parseTokenPolicy(value: string): TokenPolicy {
  if (!TOKEN_POLICIES.includes(value as TokenPolicy)) throw usage(`--tokens takes ${TOKEN_POLICIES.join(' | ')}`);
  return value as TokenPolicy;
}

export function approvalNeedsToken(policy: TokenPolicy): boolean {
  return policy === 'strict';
}

export function irreversibleNeedsToken(policy: TokenPolicy): boolean {
  return policy !== 'off';
}
