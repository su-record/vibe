#!/usr/bin/env node
/**
 * validate-skill-invocation.ts — SKILL.md frontmatter 의 `invocation` 필드 검증
 *
 * 규칙:
 *   1. 모든 SKILL.md 는 `invocation: [...]` 필드를 가진다.
 *   2. 모드 값은 `command | auto | chain` 중에서만 선택한다.
 *   3. `command` 모드는 다음 중 하나를 만족해야 한다.
 *      a) commands/{vibe.X}.md 가 존재 (skill name `vibe-X` ↔ command `vibe.X`)
 *      b) 어떤 command 또는 다른 skill 의 본문에 `Load skill <name>` 으로 호출됨
 *   4. `auto` 모드는 top-level `triggers` 또는 sections[].triggers 가 비어있지 않아야 한다.
 *   5. `chain` 모드는 다른 skill 의 `chain-next:` 에 본 skill 이 등재되어 있어야 한다.
 *
 * 위반 시 exit code 1.
 *
 * Usage:
 *   npx tsx scripts/validate-skill-invocation.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const COMMANDS_DIR = path.join(ROOT, 'commands');

const VALID_MODES = new Set(['command', 'auto', 'chain']);

interface Parsed {
  name: string;
  file: string;
  invocation: string[] | null;
  hasTriggers: boolean;
  chainNext: string[];
}

function parse(file: string): Parsed | null {
  const raw = fs.readFileSync(file, 'utf-8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = m[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';

  const invMatch = fm.match(/^invocation:\s*\[([^\]]*)\]/m);
  const invocation = invMatch
    ? invMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    : null;

  const trigMatch = fm.match(/^triggers:\s*\[([^\]]*)\]/m);
  const sectionTrigMatch = fm.match(/^\s+triggers:\s*\[([^\]]*)\]/m);
  const hasTriggers =
    !!(trigMatch && trigMatch[1].trim().length > 0) ||
    !!(sectionTrigMatch && sectionTrigMatch[1].trim().length > 0);

  const chainMatch = fm.match(/^chain-next:\s*\[([^\]]*)\]/m);
  const chainNext = chainMatch
    ? chainMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    : [];

  return { name, file, invocation, hasTriggers, chainNext };
}

function collectLoadRefs(): Set<string> {
  const refs = new Set<string>();
  for (const e of fs.readdirSync(COMMANDS_DIR)) {
    if (!e.endsWith('.md')) continue;
    const txt = fs.readFileSync(path.join(COMMANDS_DIR, e), 'utf-8');
    for (const m of txt.matchAll(/Load skill\s+`?([a-z0-9][\w:-]*)`?/g)) refs.add(m[1]);
  }
  for (const dir of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const f = path.join(SKILLS_DIR, dir.name, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf-8');
    for (const m of txt.matchAll(/Load skill\s+`?([a-z0-9][\w:-]*)`?/g)) refs.add(m[1]);
  }
  return refs;
}

function hasMatchingCommandFile(skillName: string): boolean {
  // skill `vibe-X` ↔ command `vibe.X.md` (dash → dot for vibe-* family)
  if (skillName.startsWith('vibe-')) {
    const candidate = path.join(COMMANDS_DIR, `vibe.${skillName.slice(5)}.md`);
    if (fs.existsSync(candidate)) return true;
  }
  // also literal `{name}.md`
  return fs.existsSync(path.join(COMMANDS_DIR, `${skillName}.md`));
}

function main() {
  const skills: Parsed[] = [];
  for (const dir of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const f = path.join(SKILLS_DIR, dir.name, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const p = parse(f);
    if (p) skills.push(p);
  }

  const chainedSet = new Set<string>();
  for (const s of skills) for (const c of s.chainNext) chainedSet.add(c);

  const loadRefs = collectLoadRefs();
  const errors: string[] = [];

  for (const s of skills) {
    const rel = path.relative(ROOT, s.file);

    if (!s.invocation || s.invocation.length === 0) {
      errors.push(`${rel}: missing or empty \`invocation\` field`);
      continue;
    }

    for (const mode of s.invocation) {
      if (!VALID_MODES.has(mode)) {
        errors.push(`${rel}: unknown invocation mode \`${mode}\` (allowed: ${[...VALID_MODES].join(', ')})`);
      }
    }

    if (s.invocation.includes('command')) {
      if (!hasMatchingCommandFile(s.name) && !loadRefs.has(s.name)) {
        errors.push(`${rel}: \`command\` mode declared, but no matching commands/*.md nor \`Load skill ${s.name}\` reference`);
      }
    }

    if (s.invocation.includes('auto')) {
      if (!s.hasTriggers) {
        errors.push(`${rel}: \`auto\` mode declared, but \`triggers\` field is empty`);
      }
    }

    if (s.invocation.includes('chain')) {
      if (!chainedSet.has(s.name)) {
        errors.push(`${rel}: \`chain\` mode declared, but no other skill lists ${s.name} in chain-next`);
      }
    }
  }

  if (errors.length === 0) {
    console.log(`✓ ${skills.length} skills — all invocation declarations valid.`);
    return;
  }

  console.error(`✗ ${errors.length} violation(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

main();
