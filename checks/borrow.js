#!/usr/bin/env node
// The precision devices taken from the public anti-slop skills are actually in the packs and the
// reviewers: strength tiers, five questions, the portability test, notes-to-the-writer, sample-outranks-
// rules, and the what-is-not-a-tell list; the English catalogue names the new patterns; every text
// reviewer carries the overlap rule and may end a REJECT with KEEP lines.
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const errors = [];
const read = (f) => fs.readFileSync(path.join(root, f), 'utf-8');

const HEADINGS = {
  'skills/antislop-en/SKILL.md': ['### Strength tiers', '### Five questions before a cut', '### Portability test', '### Notes to the writer are not content', '### A sample outranks the rules', '### What is not a tell'],
  'skills/antislop-ko/SKILL.md': ['### 표지의 강도', '### 자르기 전 다섯 질문', '### 이식 시험', '### 원문 속 지시문', '### 필자 샘플이 규칙보다 앞선다', '### 표지가 아닌 것', '### 조사·어미 생략'],
};
for (const [file, headings] of Object.entries(HEADINGS)) {
  const text = read(file);
  for (const h of headings) if (!text.split('\n').some((l) => l.trim() === h)) errors.push(`${file}: no heading "${h}"`);
}

const en = read('skills/antislop-en/SKILL.md');
for (const pattern of ['false range', 'serves as', 'magic adverb', 'Not X. Not Y. Just Z.', 'bold-first bullet', 'colon reveal', 'flywheel']) {
  if (!en.toLowerCase().includes(pattern.toLowerCase())) errors.push(`skills/antislop-en/SKILL.md: the catalogue does not name "${pattern}"`);
}

const ko = read('skills/antislop-ko/SKILL.md');
if (!ko.includes('줄표')) errors.push('skills/antislop-ko/SKILL.md: no 줄표 rule');
const omission = ko.split('### 조사·어미 생략')[1]?.split('\n### ')[0] ?? '';
const pairs = (omission.match(/→/g) || []).length;
if (pairs < 4) errors.push(`skills/antislop-ko/SKILL.md: 조사·어미 생략 has ${pairs} before → after pairs (needs 4)`);

for (const file of ['reviewers/ko/1-copy-editor.md', 'reviewers/ko/2-chief-editor.md', 'reviewers/en/1-copy-editor.md', 'reviewers/en/2-chief-editor.md']) {
  const text = read(file);
  if (!text.includes('KEEP')) errors.push(`${file}: no KEEP line in the REJECT format`);
  if (!/(weak|약한)/i.test(text)) errors.push(`${file}: no overlap rule for weak tells`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('borrowed devices in place: six sections in each text pack, the new English patterns, 줄표 and 조사·어미 생략 in Korean, KEEP and the overlap rule in all four reviewers');
