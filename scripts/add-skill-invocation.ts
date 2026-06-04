#!/usr/bin/env node
/**
 * add-skill-invocation.ts — 모든 SKILL.md frontmatter 에 `invocation: [...]` 필드 추가
 *
 * 분류 규칙:
 *   - command: `user-invocable: true`
 *   - auto:    top-level `triggers` 가 비어있지 않거나, sections[].triggers 가 존재함
 *   - chain:   다른 skill 의 `chain-next:` 에 본 skill 이름이 등장
 *
 * 한 skill 이 여러 mode 를 가질 수 있어 배열로 표기한다.
 *
 * Usage:
 *   npx tsx scripts/add-skill-invocation.ts          # 적용
 *   npx tsx scripts/add-skill-invocation.ts --dry    # 미적용, 결과만 출력
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const COMMANDS_DIR = path.join(ROOT, 'commands');

const DRY = process.argv.includes('--dry');

interface SkillInfo {
  name: string;
  file: string;
  hasTriggers: boolean;
  userInvocable: boolean | null;
  chainNext: string[];
  raw: string;
  frontmatter: string;
  frontmatterStart: number;
  frontmatterEnd: number;
}

function readSkill(file: string): SkillInfo | null {
  const raw = fs.readFileSync(file, 'utf-8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = m[1];

  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  const userInvocableMatch = fm.match(/^user-invocable:\s*(true|false)\s*$/m);
  const userInvocable = userInvocableMatch ? userInvocableMatch[1] === 'true' : null;

  const trigMatch = fm.match(/^triggers:\s*\[([^\]]*)\]/m);
  const sectionTrigMatch = fm.match(/^\s+triggers:\s*\[([^\]]*)\]/m);
  const hasTriggers =
    (trigMatch && trigMatch[1].trim().length > 0) ||
    (sectionTrigMatch !== null && sectionTrigMatch[1].trim().length > 0);

  const chainMatch = fm.match(/^chain-next:\s*\[([^\]]*)\]/m);
  const chainNext = chainMatch
    ? chainMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    : [];

  return {
    name,
    file,
    hasTriggers: !!hasTriggers,
    userInvocable,
    chainNext,
    raw,
    frontmatter: fm,
    frontmatterStart: m.index ?? 0,
    frontmatterEnd: (m.index ?? 0) + m[0].length,
  };
}

function collectSkills(): SkillInfo[] {
  const out: SkillInfo[] = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const f = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const info = readSkill(f);
    if (info) out.push(info);
  }
  return out;
}

function collectCommandLoadRefs(): Set<string> {
  const refs = new Set<string>();
  // 1) skill loaded explicitly by any legacy command via `Load skill <name>`
  if (fs.existsSync(COMMANDS_DIR)) {
    for (const entry of fs.readdirSync(COMMANDS_DIR)) {
      if (!entry.endsWith('.md')) continue;
      const txt = fs.readFileSync(path.join(COMMANDS_DIR, entry), 'utf-8');
      for (const m of txt.matchAll(/Load skill\s+`?([a-z0-9][\w:-]*)`?/g)) {
        refs.add(m[1]);
      }
    }
  }
  // 2) skill loaded by another skill via `Load skill <name>` (cross-skill)
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const f = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf-8');
    for (const m of txt.matchAll(/Load skill\s+`?([a-z0-9][\w:-]*)`?/g)) {
      refs.add(m[1]);
    }
  }
  return refs;
}

function classify(skills: SkillInfo[]) {
  const chainedSet = new Set<string>();
  for (const s of skills) {
    for (const c of s.chainNext) chainedSet.add(c);
  }
  const loadedSet = collectCommandLoadRefs();

  return skills.map(s => {
    const modes: string[] = [];
    if (s.userInvocable === true) modes.push('command');
    if (s.hasTriggers) modes.push('auto');
    if (chainedSet.has(s.name) || loadedSet.has(s.name)) modes.push('chain');
    if (modes.length === 0) {
      // fallback: passive reference skill — neither commanded, triggered, nor chained.
      // Treat as `auto` since Claude may still discover it via description.
      modes.push('auto');
    }
    return { skill: s, modes };
  });
}

function injectInvocation(s: SkillInfo, modes: string[]): string {
  const line = `invocation: [${modes.join(', ')}]`;

  // If existing invocation: line present, replace it; otherwise insert after `name:` line.
  const fmLines = s.frontmatter.split(/\r?\n/);
  const existingIdx = fmLines.findIndex(l => /^invocation:/.test(l));
  if (existingIdx !== -1) {
    fmLines[existingIdx] = line;
  } else {
    const nameIdx = fmLines.findIndex(l => /^name:/.test(l));
    if (nameIdx === -1) return s.raw;
    fmLines.splice(nameIdx + 1, 0, line);
  }
  const newFm = fmLines.join('\n');
  return s.raw.slice(0, s.frontmatterStart) + `---\n${newFm}\n---` + s.raw.slice(s.frontmatterEnd);
}

function main() {
  const skills = collectSkills();
  const classified = classify(skills);

  console.log(`Found ${skills.length} skills.`);
  const summary: Record<string, number> = {};
  for (const { skill, modes } of classified) {
    const key = modes.join('+');
    summary[key] = (summary[key] ?? 0) + 1;
    console.log(`  ${skill.name.padEnd(36)} → [${modes.join(', ')}]`);
  }
  console.log('\nSummary:');
  for (const [k, v] of Object.entries(summary).sort()) console.log(`  ${k.padEnd(20)} ${v}`);

  if (DRY) {
    console.log('\n(--dry) no files written.');
    return;
  }

  let written = 0;
  for (const { skill, modes } of classified) {
    const next = injectInvocation(skill, modes);
    if (next !== skill.raw) {
      fs.writeFileSync(skill.file, next);
      written++;
    }
  }
  console.log(`\nWrote ${written} files.`);
}

main();
