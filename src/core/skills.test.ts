import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VibeError } from './errors.js';
import type { GithubClient } from './github.js';
import { ask } from './inbox.js';
import { draft } from './intent.js';
import { readLedger } from './ledger.js';
import { addSkill, commandsIn, createSkill, dismissProposal, listSkills, markUsed, pruneSkills, readRegistry, suggestSkills } from './skills.js';
import { readState, writeState } from './state.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-skills-'));
  fs.mkdirSync(path.join(root, '.vibe'));
  fs.mkdirSync(path.join(root, '.claude'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const SKILL_MD = '---\nname: csv-settle\ndescription: settle\n---\n# csv-settle\n\n```bash\nnode scripts/settle.js orders.csv\n```\n$ vibe check settle\n';
const FIXTURE: Record<string, unknown> = {
  '/branches/main': { commit: { sha: 'abc123abc123abc123' } },
  '/contents/skills/csv-settle/SKILL.md?': { name: 'SKILL.md', type: 'file', path: 'skills/csv-settle/SKILL.md', content: Buffer.from(SKILL_MD).toString('base64'), encoding: 'base64' },
  '/contents/skills/csv-settle/notes.md?': { name: 'notes.md', type: 'file', path: 'skills/csv-settle/notes.md', content: 'notes', encoding: 'utf-8' },
  '/contents/skills/csv-settle?': [{ name: 'SKILL.md', type: 'file', path: 'skills/csv-settle/SKILL.md' }, { name: 'notes.md', type: 'file', path: 'skills/csv-settle/notes.md' }, { name: 'sub', type: 'dir', path: 'skills/csv-settle/sub' }],
  '/repos/org/skills': { default_branch: 'main', license: { spdx_id: 'MIT' } },
};
const fake: GithubClient = { authenticated: true, get: (p) => {
  const key = Object.keys(FIXTURE).find((k) => p.includes(k));
  return key ? Promise.resolve(FIXTURE[key]) : Promise.reject(new Error(`no fixture for ${p}`));
} };

describe('project-local skills — installed only with a check, never globally', () => {
  it('skills: create needs a check type or a scenario; the skeleton lands in every client dir that exists and is registered', () => {
    expect(() => createSkill(root, { name: 'settle' })).toThrowError(VibeError);
    expect(() => createSkill(root, { name: 'vibe.build', checkType: 'run' })).toThrowError(/common skill/);
    const r = createSkill(root, { name: 'settle', checkType: 'file' });
    expect(r.paths).toEqual(['.claude/skills/settle/SKILL.md']);
    const md = fs.readFileSync(path.join(root, r.paths[0]!), 'utf-8');
    expect(md).toContain('name: settle');
    expect(md).toContain('vibe skill used settle');
    expect(md).toContain('type: file');
    draft(root, '# t\n\n## Why\nx\n', '- { id: total, then: x, check: { type: file, path: out.csv, sum: { column: amount, equals: 10 } } }\n- { id: ask, then: x, check: { type: human, question: q } }');
    fs.mkdirSync(path.join(root, '.codex'));
    const fromScenario = createSkill(root, { name: 'total-guard', fromScenario: 'total' });
    expect(fromScenario.check).toEqual({ type: 'file', path: 'out.csv', sum: { column: 'amount', equals: 10 } });
    expect(fromScenario.paths).toEqual(['.claude/skills/total-guard/SKILL.md', '.codex/skills/total-guard/SKILL.md']);
    expect(() => createSkill(root, { name: 'ask-guard', fromScenario: 'ask' })).toThrowError(/human/);
    expect(readRegistry(root).skills.map((s) => s.name)).toEqual(['settle', 'total-guard']);
    expect(readLedger(root).filter((e) => e.event === 'skill')).toHaveLength(2);
  });

  it('skills: add shows the commands and installs nothing until --yes; then pins the commit and records the license', async () => {
    const preview = await addSkill(root, { spec: 'org/skills@csv-settle', yes: false }, fake);
    expect(preview).toMatchObject({ installed: false, ref: 'org/skills@csv-settle#abc123abc123', license: 'MIT', commands: ['node scripts/settle.js orders.csv', 'vibe check settle'], files: ['SKILL.md', 'notes.md'] });
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'csv-settle'))).toBe(false);
    const done = await addSkill(root, { spec: 'org/skills@csv-settle', yes: true }, fake);
    expect(done.installed).toBe(true);
    expect(fs.readFileSync(path.join(root, '.claude', 'skills', 'csv-settle', 'notes.md'), 'utf-8')).toBe('notes');
    expect(readRegistry(root).skills[0]).toMatchObject({ name: 'csv-settle', kind: 'added', source: 'org/skills@csv-settle#abc123abc123', license: 'MIT', check: null });
    expect(await addSkill(root, { spec: 'org/skills@csv-settle', pin: 'fffffffffffff', yes: false }, fake)).toMatchObject({ sha: 'fffffffffffff' });
    expect(commandsIn('# t\n```\n# comment\nls -la\n```\ntext\n$ pwd\n')).toEqual(['ls -la', 'pwd']);
  });

  it('skills: list · used · prune — unused for N runs goes, used stays', () => {
    createSkill(root, { name: 'old', checkType: 'run' });
    createSkill(root, { name: 'live', checkType: 'run' });
    writeState(root, { ...readState(root), runs: 12 });
    markUsed(root, 'live');
    expect(listSkills(root).project.find((s) => s.name === 'live')?.lastUsedRun).toBe(12);
    expect(pruneSkills(root, { dryRun: true })).toMatchObject({ removed: ['old'], kept: ['live'], threshold: 10 });
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'old'))).toBe(true);
    pruneSkills(root);
    expect(fs.existsSync(path.join(root, '.claude', 'skills', 'old'))).toBe(false);
    expect(listSkills(root).project.map((s) => s.name)).toEqual(['live']);
    expect(() => markUsed(root, 'old')).toThrowError(VibeError);
  });

  it('suggest: proposals come from http hosts, regression clusters, repeated questions and handoff; dismissed ones stay quiet', () => {
    draft(root, '# t\n\n## Why\nx\n', [
      '- { id: pay, then: x, check: { type: http, url: "https://api.stripe.com/v1/balance" } }',
      '- { id: local, then: x, check: { type: http, url: "http://localhost:3000/" } }',
      '- { id: send, irreversible: send, then: x, check: { type: run, cmd: "node send.js" } }',
    ].join('\n'));
    fs.mkdirSync(path.join(root, '.vibe', 'regressions'));
    fs.writeFileSync(path.join(root, '.vibe', 'regressions', 'r-1-a.yaml'), '- { id: r-1-a, then: "[regression] a — source send: x", check: { type: run, cmd: "true" } }');
    fs.writeFileSync(path.join(root, '.vibe', 'regressions', 'r-2-b.yaml'), '- { id: r-2-b, then: "[regression] b — source send: x", check: { type: run, cmd: "true" } }');
    ask(root, { question: 'Which account receives the settlement?' });
    ask(root, { question: 'Which account receives the settlement?' });
    ask(root, { question: 'STUCK: x' });
    const before = suggestSkills(root, true);
    expect(before.map((p) => [p.kind, p.source])).toEqual([['create', 'regressions'], ['import', 'scenarios'], ['knowledge', 'inbox']]);
    expect(before[1]?.ref).toBe('vibe skill search stripe');
    expect(before[0]?.why).toBe('2 regressions trace to scenario send');
    writeState(root, { ...readState(root), state: 'DONE' });
    expect(suggestSkills(root, true).map((p) => p.source)).toEqual(['state', 'regressions', 'scenarios', 'inbox']);
    expect(suggestSkills(root)).toHaveLength(3);
    dismissProposal(root, 'vibe skill search stripe');
    expect(suggestSkills(root, true).map((p) => p.source)).toEqual(['state', 'regressions', 'inbox']);
  });
});
