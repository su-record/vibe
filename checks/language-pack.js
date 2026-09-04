#!/usr/bin/env node
// Every language pack `skills/antislop-<lang>` has a spec-conformant name, a SKILL.md of at most 600 lines,
// both reviewer prompts under `reviewers/<lang>/` of at most 300 lines each, a Claude agent per reviewer whose
// body equals the prompt, and no client-only tool name inside the prompts (they run through any client CLI).
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CLIENT_ONLY = /\b(SendMessage|subagent_type|Agent 도구|Agent tool|TodoWrite|WebFetch)\b/;
const packs = fs.readdirSync(path.join(root, 'skills')).filter((n) => n.startsWith('antislop-')).sort();
const errors = [];
const lines = (f) => fs.readFileSync(f, 'utf-8').split('\n').length;
if (packs.length === 0) errors.push('no language pack under skills/');
for (const pack of packs) {
  const lang = pack.replace('antislop-', '');
  const skill = path.join(root, 'skills', pack, 'SKILL.md');
  if (!NAME_RE.test(pack)) errors.push(`${pack}: name is outside the spec grammar`);
  if (!fs.existsSync(skill)) errors.push(`${pack}: no SKILL.md`);
  else {
    const body = fs.readFileSync(skill, 'utf-8');
    if (!new RegExp(`^name:\\s*${pack}\\s*$`, 'm').test(body)) errors.push(`${pack}: SKILL.md name differs from its directory`);
    if (lines(skill) > 600) errors.push(`${pack}: SKILL.md ${lines(skill)} lines (limit 600)`);
  }
  for (const stage of ['copy-editor', 'chief-editor']) {
    const prompt = path.join(root, 'reviewers', lang, `${stage}.md`);
    if (!fs.existsSync(prompt)) {
      errors.push(`${pack}: missing reviewers/${lang}/${stage}.md`);
      continue;
    }
    const text = fs.readFileSync(prompt, 'utf-8');
    if (lines(prompt) > 300) errors.push(`${pack}: reviewers/${lang}/${stage}.md ${lines(prompt)} lines (limit 300)`);
    if (CLIENT_ONLY.test(text)) errors.push(`${pack}: reviewers/${lang}/${stage}.md names a client-only tool`);
    const agent = path.join(root, 'agents', `${lang}-${stage}.md`);
    if (!fs.existsSync(agent)) errors.push(`${pack}: missing agents/${lang}-${stage}.md`);
    else {
      const md = fs.readFileSync(agent, 'utf-8');
      const body = md.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
      if (body !== text.trim()) errors.push(`${pack}: agents/${lang}-${stage}.md body differs from reviewers/${lang}/${stage}.md`);
      if (!new RegExp(`^name:\\s*${lang}-${stage}\\s*$`, 'm').test(md)) errors.push(`${pack}: agents/${lang}-${stage}.md name is not ${lang}-${stage}`);
    }
  }
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`${packs.length} language pack(s): ${packs.map((p) => `${p} (${lines(path.join(root, 'skills', p, 'SKILL.md'))} lines)`).join(', ')} — reviewers and agents in step`);
