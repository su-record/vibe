import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VibeError } from './errors.js';
import type { GithubClient } from './github.js';
import { draft } from './intent.js';
import { readLedger } from './ledger.js';
import { queriesFromIntent, research, skillDirsInTree } from './research.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-research-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const recent = new Date(Date.now() - 10 * 86_400_000).toISOString();
const RESPONSES: Record<string, unknown> = {
  '/search/repositories?q=three%20words%20nothing': { items: [] },
  '/search/repositories?q=three%20words&': { items: [{ full_name: 'x/three-words', html_url: 'https://github.com/x/three-words', description: 'three words', stargazers_count: 1, pushed_at: recent, license: { spdx_id: 'MIT' } }] },
  '/search/repositories': { items: [
    { full_name: 'acme/settle-sheet', html_url: 'https://github.com/acme/settle-sheet', description: 'settlement sheets from order csv', stargazers_count: 120, pushed_at: recent, license: { spdx_id: 'MIT' } },
    { full_name: 'x/unrelated', html_url: 'https://github.com/x/unrelated', description: 'nothing here', stargazers_count: 5, pushed_at: '2020-01-01T00:00:00Z', license: null },
  ] },
  '/search/code': { items: [{ path: 'skills/csv-settle/SKILL.md', repository: { full_name: 'org/skills', html_url: 'https://github.com/org/skills', description: 'settlement skills', pushed_at: recent, license: { spdx_id: 'MIT' } } }] },
  '/repos/anthropics/skills/git/trees': { tree: [{ path: 'skills/xlsx/SKILL.md', type: 'blob' }, { path: 'skills/pdf/SKILL.md', type: 'blob' }, { path: 'README.md', type: 'blob' }] },
  '/repos/vercel-labs/agent-skills/git/trees': { tree: [{ path: 'skills/deploy-to-vercel/SKILL.md', type: 'blob' }] },
  '/repos/NousResearch/hermes-agent/git/trees': { tree: [{ path: 'skills/devops/sdlc-review/SKILL.md', type: 'blob' }, { path: 'skills/devops/sdlc-review/tests/SKILL.md', type: 'blob' }] },
};
const fake = (authenticated = true): GithubClient => ({ authenticated, get: (p) => {
  const key = Object.keys(RESPONSES).find((k) => p.includes(k));
  return key ? Promise.resolve(RESPONSES[key]) : Promise.reject(new Error(`no fixture for ${p}`));
} });
const dead: GithubClient = { authenticated: false, get: () => Promise.reject(new VibeError('no network', 2)) };

describe('research — see what exists before building', () => {
  it('research: queries come from the intent title, http hosts and the stack', () => {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { yaml: '1', '@types/node': '1' } }));
    draft(root, '# Settlement sheet from the order CSV\n\n## Why\nx\n', `
- { id: api, then: x, check: { type: http, url: "https://api.stripe.com/v1/balance" } }
- { id: out, then: x, check: { type: file, path: out.csv, exists: true } }
`);
    expect(queriesFromIntent(root)).toEqual(['settlement sheet order csv', 'stripe sdk', 'yaml settlement']);
  });

  it('research: ranks by keyword match, recency, stars and license; drops candidates no query word describes; writes a note and a ledger line', async () => {
    const r = await research(root, { query: 'settlement csv' }, fake());
    expect(r.cached).toBe(false);
    expect(r.candidates.map((c) => c.ref)).toEqual(['acme/settle-sheet', 'org/skills@csv-settle']);
    expect(r.candidates[0]).toMatchObject({ kind: 'repo', license: 'MIT', stars: 120, action: 'knowledge: save a reference note on acme/settle-sheet' });
    expect(r.candidates[0]?.why).toContain('matches "settlement, csv"');
    expect(r.candidates[1]).toMatchObject({ kind: 'skill', action: 'vibe skill add org/skills@csv-settle' });
    expect(r.file && fs.readFileSync(r.file, 'utf-8')).toContain('| repo | [acme/settle-sheet]');
    expect(readLedger(root).at(-1)).toMatchObject({ event: 'research', detail: 'settlement csv' });
  });

  it('research: the same query is answered from the cache for a day, even with no network; no cache and no network is exit 2', async () => {
    await research(root, { query: 'settlement csv' }, fake());
    const again = await research(root, { query: 'settlement csv' }, dead);
    expect(again.cached).toBe(true);
    expect(again.candidates).toHaveLength(2);
    await expect(research(root, { query: 'something else' }, dead)).rejects.toMatchObject({ exitCode: 2 });
    await expect(research(root, { fromIntent: true }, fake())).rejects.toThrowError(/no intent/);
  });

  it('research: narrowing — an empty repository search is retried with fewer words', async () => {
    const r = await research(root, { query: 'three words nothing', sources: ['repos'] }, fake());
    expect(r.candidates.map((c) => c.ref)).toEqual(['x/three-words']);
  });

  it('research: catalogs are read with one tree request each and skills are found at any depth; code search is skipped without a token', async () => {
    const r = await research(root, { query: 'xlsx deploy sdlc' }, fake(false));
    expect(r.authenticated).toBe(false);
    expect(r.candidates.map((c) => c.ref)).toEqual(expect.arrayContaining(['anthropics/skills@xlsx', 'vercel-labs/agent-skills@deploy-to-vercel', 'NousResearch/hermes-agent@devops/sdlc-review']));
    expect(r.candidates.find((c) => c.ref.startsWith('org/'))).toBeUndefined();
    expect(skillDirsInTree([{ path: 'a/SKILL.md', type: 'blob' }, { path: 'SKILL.md', type: 'blob' }, { path: 'skills/b/c/SKILL.md', type: 'blob' }])).toEqual([{ name: 'a', dir: 'a' }, { name: 'b/c', dir: 'skills/b/c' }]);
  });
});
