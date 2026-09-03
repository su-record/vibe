#!/usr/bin/env node
/**
 * gen-skill-docs.ts — 스킬 카탈로그 자동 생성
 *
 * constants.ts의 매핑 데이터를 읽어 SKILL-CATALOG.md를 생성합니다.
 * - --dry-run: 변경 사항만 확인 (CI용)
 * - --check:   freshness 검증 (stale이면 exit 1)
 *
 * Usage:
 *   npx tsx scripts/gen-skill-docs.ts
 *   npx tsx scripts/gen-skill-docs.ts --check
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// 코어(코딩 루프: 전역 + 스택)는 skills/, extras(optional + capability)는 skills-extra/ —
// 배치 SSOT 는 constants.ts CORE_SKILLS/EXTRA_SKILLS, 검증은 skill-namespace.test.ts (SPEC skill-tier-boundary)
const SKILLS_DIR = path.join(ROOT, 'skills');
const EXTRA_SKILLS_DIR = path.join(ROOT, 'skills-extra');
const OUTPUT_FILE = path.join(ROOT, 'SKILL-CATALOG.md');

// ─── constants.ts에서 데이터 임포트 ───

interface SkillFrontmatter {
  name: string;
  description: string;
  triggers?: string[];
  priority?: number;
  invocation?: string[];
}

function parseSkillFrontmatter(filePath: string): SkillFrontmatter | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    const yaml = match[1];
    const name = yaml.match(/name:\s*(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
    const description = yaml.match(/description:\s*["'](.+?)["']/)?.[1]
      ?? yaml.match(/description:\s*(.+)/)?.[1]?.trim() ?? '';

    const triggersMatch = yaml.match(/triggers:\s*\[([^\]]*)\]/);
    const triggers = triggersMatch
      ? triggersMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''))
      : undefined;

    const priorityMatch = yaml.match(/priority:\s*(\d+)/);
    const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : undefined;

    const invocationMatch = yaml.match(/^invocation:\s*\[([^\]]*)\]/m);
    const invocation = invocationMatch
      ? invocationMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : undefined;

    return { name, description, triggers, priority, invocation };
  } catch {
    return null;
  }
}

function loadConstants(): {
  globalSkills: string[];
  optionalSkills: string[];
  stackToSkills: Record<string, string[]>;
  capabilitySkills: Record<string, string[]>;
  stackToLanguage: Record<string, string>;
  stackToExternal: Record<string, string[]>;
} {
  const constantsPath = path.join(ROOT, 'src', 'cli', 'postinstall', 'constants.ts');
  const content = fs.readFileSync(constantsPath, 'utf-8');

  // Parse actual postinstall globals (entry + core + standard).
  const globalSkills: string[] = [];
  for (const tier of ['GLOBAL_SKILLS_ENTRY', 'GLOBAL_SKILLS_STANDARD']) {
    const tierMatch = content.match(new RegExp(`export const ${tier}[^[]*\\[([\\s\\S]*?)\\]`));
    if (tierMatch) {
      const names = tierMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? [];
      globalSkills.push(...names);
    }
  }
  const optionalMatch = content.match(/export const GLOBAL_SKILLS_OPTIONAL[^[]*\[([\s\S]*?)\]/);
  const optionalSkills = optionalMatch?.[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? [];

  // Parse STACK_TO_SKILLS
  const stackToSkills = parseRecordBlock(content, 'STACK_TO_SKILLS');
  const capabilitySkills = parseRecordBlock(content, 'CAPABILITY_SKILLS');
  const stackToExternal = parseRecordBlock(content, 'STACK_TO_EXTERNAL_SKILLS');

  // Parse STACK_TO_LANGUAGE_FILE
  const langMatch = content.match(/export const STACK_TO_LANGUAGE_FILE[^{]*\{([\s\S]*?)\};/);
  const stackToLanguage: Record<string, string> = {};
  if (langMatch) {
    const entries = langMatch[1].matchAll(/'([^']+)':\s*'([^']+)'/g);
    for (const entry of entries) {
      stackToLanguage[entry[1]] = entry[2];
    }
  }

  return { globalSkills, optionalSkills, stackToSkills, capabilitySkills, stackToLanguage, stackToExternal };
}

/**
 * `export const` 에 앵커링한다 — 이름만으로 찾으면 **주석 속 언급이 먼저 잡힌다**.
 * 실측: constants.ts 주석에 `CAPABILITY_SKILLS['event-automation']` 이라고 쓴 순간
 * `[^{]*` 가 그 지점부터 다음 `{`(= STACK_TO_SKILLS)까지 흘러가, capability 매핑이
 * 통째로 빈 객체가 되고 해당 스킬 11개가 카탈로그에서 조용히 `(unrouted)` 로 바뀌었다.
 */
function parseRecordBlock(content: string, name: string): Record<string, string[]> {
  const regex = new RegExp(`export const ${name}[^{]*\\{([\\s\\S]*?)\\};`);
  const match = content.match(regex);
  if (!match) return {};

  const result: Record<string, string[]> = {};
  const entries = match[1].matchAll(/'([^']+)':\s*\[([^\]]*)\]/g);
  for (const entry of entries) {
    const key = entry[1];
    const values = entry[2].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) ?? [];
    result[key] = values;
  }
  return result;
}

function discoverSkills(root: string): Map<string, SkillFrontmatter> {
  const skills = new Map<string, SkillFrontmatter>();
  if (!fs.existsSync(root)) return skills;

  const dirs = fs.readdirSync(root, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const skillMd = path.join(root, dir.name, 'SKILL.md');
    const fm = parseSkillFrontmatter(skillMd);
    if (fm) skills.set(dir.name, fm);
  }
  return skills;
}

interface DiscoveredSkills {
  all: Map<string, SkillFrontmatter>;
  core: Map<string, SkillFrontmatter>;
  extra: Map<string, SkillFrontmatter>;
}

function discoverAllSkills(): DiscoveredSkills {
  const core = discoverSkills(SKILLS_DIR);
  const extra = discoverSkills(EXTRA_SKILLS_DIR);
  return { all: new Map([...core, ...extra]), core, extra };
}

function generateCatalog(): string {
  const { globalSkills, optionalSkills, stackToSkills, capabilitySkills, stackToLanguage, stackToExternal } = loadConstants();
  const { all: allSkills, core: coreSkills, extra: extraSkills } = discoverAllSkills();

  const lines: string[] = [];
  const timestamp = new Date().toISOString().split('T')[0];

  lines.push('<!-- AUTO-GENERATED by scripts/gen-skill-docs.ts — DO NOT EDIT MANUALLY -->');
  lines.push(`<!-- Last generated: ${timestamp} -->`);
  lines.push('');
  lines.push('# Vibe Skill Catalog');
  lines.push('');
  lines.push(`> Core: ${coreSkills.size} (\`skills/\` — global ${globalSkills.length} + stack-local ${new Set(Object.values(stackToSkills).flat()).size}) · Extras: ${extraSkills.size} (\`skills-extra/\` — optional ${optionalSkills.length} + capability ${new Set(Object.values(capabilitySkills).flat()).size}) · Total: ${allSkills.size} skills`);
  lines.push('');

  // ─── Extras ───
  lines.push('## Extras (skills-extra/ — outside the coding loop)');
  lines.push('');
  lines.push('> Not baked into the marketplace plugin tree. Reached only by capability opt-in (`vibe init` → `.vibe/config.json` `capabilities`) or explicit invocation. Placement is enforced against `EXTRA_SKILLS` in `constants.ts`.');
  lines.push('');
  for (const name of [...extraSkills.keys()].sort()) {
    const fm = extraSkills.get(name);
    lines.push(`- \`${name}\` — ${fm?.description ?? '—'}`);
  }
  lines.push('');

  // ─── Optional Skills ───
  lines.push('## Optional Skills (explicit invocation)');
  lines.push('');
  for (const name of optionalSkills) {
    const fm = allSkills.get(name);
    lines.push(`- \`${name}\` — ${fm?.description ?? '—'}`);
  }
  lines.push('');

  // ─── Global Skills ───
  lines.push('## Global Skills (postinstall → ~/.claude/skills/)');
  lines.push('');
  lines.push('| Skill | Invocation | Description | Triggers | Priority |');
  lines.push('|-------|------------|-------------|----------|----------|');
  for (const name of globalSkills) {
    const fm = allSkills.get(name);
    const desc = fm?.description ?? '—';
    const triggers = fm?.triggers?.join(', ') ?? '—';
    const priority = fm?.priority ?? '—';
    const invocation = fm?.invocation?.join(', ') ?? '—';
    lines.push(`| \`${name}\` | ${invocation} | ${desc} | ${triggers} | ${priority} |`);
  }
  lines.push('');

  // ─── Stack → Skills Routing ───
  lines.push('## Stack → Skills Routing (vibe init/update → .claude/skills/)');
  lines.push('');
  lines.push('| Stack Type | Skills |');
  lines.push('|------------|--------|');
  for (const [stack, skills] of Object.entries(stackToSkills)) {
    lines.push(`| \`${stack}\` | ${skills.map(s => `\`${s}\``).join(', ')} |`);
  }
  lines.push('');

  // ─── Capability → Skills Routing ───
  lines.push('## Capability → Skills Routing');
  lines.push('');
  lines.push('| Capability | Skills |');
  lines.push('|------------|--------|');
  for (const [cap, skills] of Object.entries(capabilitySkills)) {
    lines.push(`| \`${cap}\` | ${skills.map(s => `\`${s}\``).join(', ')} |`);
  }
  lines.push('');

  // ─── External Skills ───
  if (Object.keys(stackToExternal).length > 0) {
    lines.push('## External Skills (skills.sh)');
    lines.push('');
    lines.push('| Stack Type | External Package |');
    lines.push('|------------|-----------------|');
    for (const [stack, skills] of Object.entries(stackToExternal)) {
      lines.push(`| \`${stack}\` | ${skills.map(s => `\`${s}\``).join(', ')} |`);
    }
    lines.push('');
  }

  // ─── Stack → Language Rules ───
  lines.push('## Stack → Language Rules');
  lines.push('');
  lines.push('| Stack Type | Language Rule File |');
  lines.push('|------------|--------------------|');
  for (const [stack, file] of Object.entries(stackToLanguage)) {
    lines.push(`| \`${stack}\` | \`${file}\` |`);
  }
  lines.push('');

  // ─── All Skills Detail ───
  lines.push('## All Skills (Alphabetical)');
  lines.push('');
  const sorted = [...allSkills.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, fm] of sorted) {
    const scope = globalSkills.includes(name)
      ? 'global'
      : optionalSkills.includes(name)
        ? 'optional'
      : Object.values(stackToSkills).flat().includes(name)
        ? 'stack-local'
        : Object.values(capabilitySkills).flat().includes(name)
          ? 'capability'
          : 'unrouted';
    lines.push(`### \`${name}\` (${scope})`);
    lines.push('');
    lines.push(`- **Description**: ${fm.description}`);
    if (fm.invocation && fm.invocation.length > 0) lines.push(`- **Invocation**: ${fm.invocation.join(', ')}`);
    if (fm.triggers && fm.triggers.length > 0) lines.push(`- **Triggers**: ${fm.triggers.join(', ')}`);
    if (fm.priority) lines.push(`- **Priority**: ${fm.priority}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ───

function main(): void {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isCheck = args.includes('--check');

  const generated = generateCatalog();

  if (isDryRun) {
    process.stdout.write(generated);
    return;
  }

  if (isCheck) {
    if (!fs.existsSync(OUTPUT_FILE)) {
      console.error('STALE: SKILL-CATALOG.md does not exist. Run: npx tsx scripts/gen-skill-docs.ts');
      process.exit(1);
    }
    const existing = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    // Compare ignoring timestamp line
    const normalize = (s: string): string => s.replace(/<!-- Last generated: .* -->/, '').trim();
    if (normalize(existing) !== normalize(generated)) {
      console.error('STALE: SKILL-CATALOG.md is out of date. Run: npx tsx scripts/gen-skill-docs.ts');
      process.exit(1);
    }
    console.log('FRESH: SKILL-CATALOG.md is up to date.');
    return;
  }

  fs.writeFileSync(OUTPUT_FILE, generated);
  console.log(`Generated ${OUTPUT_FILE} (${generated.split('\n').length} lines)`);
}

main();
