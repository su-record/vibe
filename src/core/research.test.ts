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
    expect(readLedger(root).at(-1)).toMatchObject({ event: 'research', detail: 'settlement csv (last 30 days)' });
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

  it('intent: queries come from what the success section names and repeats, never the title\'s first words; a candidate matching only a short word is dropped', async () => {
    const own = [
      '# vibe 4 · 4.1.14 — one spec: slim review with usage, the code pack, two deterministic checks',
      '',
      '## Why',
      'The last four releases were cut one conversation at a time.',
      '',
      '## What counts as success',
      '- The `review` check runs each stage through the reader drivers; the reviewer prompt is the system prompt.',
      '- `antislop-code` joins the packs with a reviewer and a maintainer; the `review` check takes `pack: code`.',
      '- Every review stage reports usage; the ledger holds a usage event per stage and per reader call.',
      '- The design pack and the code pack are reviewed live on both clients.',
      '',
      '## Constraints',
      '- No new dependency.',
    ].join('\n');
    fs.writeFileSync(path.join(root, '.vibe', 'intent.md'), own);
    fs.writeFileSync(path.join(root, '.vibe', 'scenarios.yaml'), '- { id: x, then: y, check: { type: run, cmd: "true" } }\n');
    const queries = queriesFromIntent(root);
    expect(queries.length).toBeGreaterThanOrEqual(2);
    for (const q of queries) for (const w of q.split(' ')) expect(['one', 'spec', 'slim']).not.toContain(w);
    expect(queries.join(' ')).toMatch(/review|pack|reviewer|usage|design|code/);
    const noisy: GithubClient = { authenticated: false, get: (p) => {
      if (p.includes('/search/repositories')) return Promise.resolve({ items: [{ full_name: 'v9l9/minecraft-', html_url: 'https://github.com/v9l9/minecraft-', description: 'one block at a time', stargazers_count: 6, pushed_at: recent, license: null }] });
      if (p.includes('/git/trees')) return Promise.resolve({ tree: [] });
      return Promise.reject(new Error(`no fixture for ${p}`));
    } };
    const r = await research(root, { fromIntent: true, query: 'one review pack' }, noisy);
    expect(r.candidates.map((c) => c.ref)).not.toContain('v9l9/minecraft-');
  });

  it('window: activity inside the window ranks first whatever the score, nothing is dropped, the why says what moved, a failed releases request falls back to the commit, and the cache key follows the window', async () => {
    const now = new Date('2026-09-08T00:00:00Z').getTime();
    const day = 86_400_000;
    const iso = (d: number): string => new Date(now - d * day).toISOString();
    draft(root, '# Settlement sheet\n\n## What counts as success\n- the `settle` sheet is built from the order csv\n- the settle sheet totals match the order csv\n', '- { id: x, then: y, check: { type: run, cmd: "true" } }\n');
    const items = [
      { full_name: 'acme/old-but-loved', html_url: 'https://github.com/acme/old-but-loved', description: 'settle sheet order csv settle', stargazers_count: 9000, pushed_at: iso(120), license: { spdx_id: 'MIT' } },
      { full_name: 'acme/fresh', html_url: 'https://github.com/acme/fresh', description: 'settle sheet', stargazers_count: 3, pushed_at: iso(2), license: { spdx_id: 'MIT' } },
      { full_name: 'acme/broken-releases', html_url: 'https://github.com/acme/broken-releases', description: 'settle order', stargazers_count: 10, pushed_at: iso(5), license: null },
    ];
    const client: GithubClient = { authenticated: false, get: (p) => {
      if (p.includes('/search/repositories')) return Promise.resolve({ items });
      if (p.includes('/git/trees')) return Promise.resolve({ tree: [] });
      if (p.includes('/repos/acme/old-but-loved/releases')) return Promise.resolve([{ tag_name: 'v9.0.0', published_at: iso(200) }]);
      if (p.includes('/repos/acme/old-but-loved/commits')) return Promise.resolve([{ commit: { committer: { date: iso(120) } } }]);
      if (p.includes('/repos/acme/fresh/releases')) return Promise.resolve([{ tag_name: 'v4.2.0', published_at: iso(12) }, { tag_name: 'v4.1.0', published_at: iso(40) }]);
      if (p.includes('/repos/acme/broken-releases/releases')) return Promise.reject(new Error('403'));
      if (p.includes('/repos/acme/broken-releases/commits')) return Promise.resolve([{ commit: { author: { date: iso(5) } } }]);
      return Promise.reject(new Error(`no fixture for ${p}`));
    } };
    const r = await research(root, { fromIntent: true, sources: ['repos'], now }, client);
    expect(r.days).toBe(30);
    expect(r.cutoff).toBe('2026-08-09');
    expect(r.candidates.slice(0, 2).map((c) => c.ref).sort()).toEqual(['acme/broken-releases', 'acme/fresh']); // the two inside the window first, by score between them
    expect(r.candidates[2]?.ref).toBe('acme/old-but-loved'); // the best-scored repository is last because it is stale; nothing dropped
    const fresh = r.candidates.find((c) => c.ref === 'acme/fresh')!;
    expect(fresh.why).toContain('released v4.2.0 12 days ago');
    expect(fresh.recent).toMatchObject({ inWindow: true, lastCommitAt: null });
    expect(r.candidates.find((c) => c.ref === 'acme/broken-releases')?.why).toContain('last commit 5 days ago, no release in 30 days');
    const old = r.candidates.find((c) => c.ref === 'acme/old-but-loved')!;
    expect(old.why).toContain('last commit 4 months ago, no release in 30 days');
    expect(old.recent?.inWindow).toBe(false);
    expect(old.score).toBeGreaterThan(fresh.score); // score alone would have put it first
    expect(fs.readFileSync(r.file!, 'utf-8')).toContain('Window: last 30 days (since 2026-08-09)');

    const week = await research(root, { fromIntent: true, sources: ['repos'], now, days: 7 }, client);
    expect(week.cached).toBe(false); // another window is another cache key
    expect(week.candidates.map((c) => c.ref)).toEqual(['acme/broken-releases', 'acme/old-but-loved', 'acme/fresh']); // the 12-day release is outside a 7-day window: fresh is stale now and ranks by score among the stale
    expect(week.candidates.find((c) => c.ref === 'acme/fresh')?.why).toContain('no release in 7 days');
    const again = await research(root, { fromIntent: true, sources: ['repos'], now, days: 7 }, client);
    expect(again.cached).toBe(true);
  });
});
