#!/usr/bin/env node
// Every antislop pack `skills/antislop-<pack>` has a spec-conformant name, a SKILL.md of at most 600 lines,
// at least two numbered reviewer stages under `reviewers/<pack>/` of at most 300 lines each, a Claude agent
// per stage whose body equals the prompt, and no client-only tool name inside the prompts (they run through
// any client CLI). A pack is a medium, not only a language: `ko`, `en`, `design`.
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STAGE_FILE = /^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const CLIENT_ONLY = /\b(SendMessage|subagent_type|Agent 도구|Agent tool|TodoWrite|WebFetch)\b/;
const packs = fs.readdirSync(path.join(root, 'skills')).filter((n) => n.startsWith('antislop-')).sort();
const errors = [];
const lines = (f) => fs.readFileSync(f, 'utf-8').split('\n').length;
if (packs.length === 0) errors.push('no pack under skills/');
const summary = [];
for (const skill of packs) {
  const pack = skill.replace('antislop-', '');
  const file = path.join(root, 'skills', skill, 'SKILL.md');
  if (!NAME_RE.test(skill)) errors.push(`${skill}: name is outside the spec grammar`);
  if (!fs.existsSync(file)) {
    errors.push(`${skill}: no SKILL.md`);
    continue;
  }
  const body = fs.readFileSync(file, 'utf-8');
  if (!new RegExp(`^name:\\s*${skill}\\s*$`, 'm').test(body)) errors.push(`${skill}: SKILL.md name differs from its directory`);
  if (lines(file) > 600) errors.push(`${skill}: SKILL.md ${lines(file)} lines (limit 600)`);
  const dir = path.join(root, 'reviewers', pack);
  const stages = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).map((n) => STAGE_FILE.exec(n)).filter(Boolean).sort((a, b) => Number(a[1]) - Number(b[1]));
  if (stages.length < 2) {
    errors.push(`${skill}: reviewers/${pack}/ needs at least two N-<stage>.md files, found ${stages.length}`);
    continue;
  }
  for (const [name, order, stage] of stages) {
    const prompt = path.join(dir, name);
    const text = fs.readFileSync(prompt, 'utf-8');
    if (lines(prompt) > 300) errors.push(`${skill}: reviewers/${pack}/${name} ${lines(prompt)} lines (limit 300)`);
    if (CLIENT_ONLY.test(text)) errors.push(`${skill}: reviewers/${pack}/${name} names a client-only tool`);
    const agent = path.join(root, 'agents', `${pack}-${stage}.md`);
    if (!fs.existsSync(agent)) {
      errors.push(`${skill}: missing agents/${pack}-${stage}.md (stage ${order})`);
      continue;
    }
    const md = fs.readFileSync(agent, 'utf-8');
    if (md.replace(/^---\n[\s\S]*?\n---\n/, '').trim() !== text.trim()) errors.push(`${skill}: agents/${pack}-${stage}.md body differs from reviewers/${pack}/${name}`);
    if (!new RegExp(`^name:\\s*${pack}-${stage}\\s*$`, 'm').test(md)) errors.push(`${skill}: agents/${pack}-${stage}.md name is not ${pack}-${stage}`);
  }
  summary.push(`${skill} (${lines(file)} lines, ${stages.map((s) => s[2]).join(' → ')})`);
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${packs.length} pack(s): ${summary.join(', ')} — reviewers and agents in step`);
