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
export const DEFAULT_TOKEN_POLICY: TokenPolicy = 'irreversible';

export const DEFAULT_CATALOGS: readonly string[] = ['anthropics/skills', 'vercel-labs/agent-skills', 'NousResearch/hermes-agent'];

export interface Config {
  tokens: TokenPolicy;
  /** GitHub repositories whose `skills/` (or root) directories are searched as skill catalogs. */
  catalogs: string[];
}

export function configPath(root: string): string {
  return vibePath(root, 'config.json');
}

export function readConfig(root: string): Config {
  const raw = readJson<Partial<Config>>(configPath(root)) ?? {};
  const tokens = TOKEN_POLICIES.includes(raw.tokens as TokenPolicy) ? (raw.tokens as TokenPolicy) : DEFAULT_TOKEN_POLICY;
  const catalogs = Array.isArray(raw.catalogs) ? raw.catalogs.filter((c): c is string => typeof c === 'string' && /^[\w.-]+\/[\w.-]+$/.test(c)) : [...DEFAULT_CATALOGS];
  return { tokens, catalogs };
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
