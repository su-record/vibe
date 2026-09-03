import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_CAPABILITIES,
  CAPABILITY_SKILLS,
  CORE_SKILLS,
  EXTRA_SKILLS,
  GLOBAL_SKILLS,
  GLOBAL_SKILLS_OPTIONAL,
  GLOBAL_SKILLS_STANDARD,
  SKILL_ROOTS,
  STACK_TO_SKILLS,
  resolveDemotedGlobalSkills,
} from '../cli/postinstall/constants.js';

const MAX_SKILL_NAME_LENGTH = 32;
// 코어(skills/)와 extras(skills-extra/) — SPEC skill-tier-boundary. 순서는 상수를 따른다.
const [CORE_DIR, EXTRA_DIR] = SKILL_ROOTS.map((dir): string => resolve(dir));

function skillNamesIn(root: string): Array<{ directory: string; name: string }> {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry): boolean =>
      entry.isDirectory() && existsSync(resolve(root, entry.name, 'SKILL.md')))
    .map((entry): { directory: string; name: string } => {
      const content = readFileSync(resolve(root, entry.name, 'SKILL.md'), 'utf8');
      const name = /^name:\s*(.+)$/m.exec(content)?.[1]?.trim() ?? '';
      return { directory: entry.name, name };
    });
}

function skillNames(): Array<{ directory: string; name: string }> {
  return SKILL_ROOTS.flatMap((dir): Array<{ directory: string; name: string }> => skillNamesIn(resolve(dir)));
}

function mappedSkills(): string[] {
  const stackSkills = Object.values(STACK_TO_SKILLS).flat();
  const capabilitySkills = Object.values(CAPABILITY_SKILLS).flat();
  return [...GLOBAL_SKILLS, ...GLOBAL_SKILLS_OPTIONAL, ...stackSkills, ...capabilitySkills];
}

describe('skill namespace contract', () => {
  it('REQ-skill-namespace-001 namespaces every exposed skill within the length limit', () => {
    const exposed = mappedSkills();

    expect(exposed.every((name): boolean => name === 'vibe' || name.startsWith('vibe.'))).toBe(true);
    expect(exposed.every((name): boolean => name.length <= MAX_SKILL_NAME_LENGTH)).toBe(true);
  });

  it('keeps directory names and frontmatter names unique and identical across both roots', () => {
    const skills = skillNames();
    const names = skills.map(({ name }): string => name);

    expect(skills.every(({ directory, name }): boolean => directory === name)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it('REQ-skill-namespace-003 namespaces every Vibe-owned install mapping', () => {
    expect(mappedSkills().every((name): boolean => name === 'vibe' || name.startsWith('vibe.'))).toBe(true);
  });

  it('REQ-skill-namespace-002 exposes one public skill for every former wrapper pair', () => {
    const names = skillNames().map(({ name }): string => name);
    const expected = ['spec', 'test', 'contract', 'regress', 'figma', 'clone', 'docs'];

    expect(names.some((name): boolean => name.startsWith('vibe.core.'))).toBe(false);
    expect(expected.every((name): boolean => names.includes(`vibe.${name}`))).toBe(true);
  });

  it('bundles internal core behavior without separate discovery entries', () => {
    const names = skillNames().map(({ name }): string => name);
    const run = readFileSync(resolve('skills/vibe.run/SKILL.md'), 'utf8');

    expect(['arch-guard', 'exec-plan', 'restraint'].every((name): boolean => !names.includes(name))).toBe(true);
    expect(run).toContain('## Bundled internal: arch-guard');
    expect(run).toContain('## Bundled internal: exec-plan');
    expect(run).toContain('## Bundled internal: restraint');
  });

  it('REQ-skill-namespace-005 preserves dots in Load skill references', () => {
    const validator = readFileSync(resolve('scripts/validate-skill-invocation.ts'), 'utf8');

    expect(validator).toContain('[\\w.:-]*');
  });

  it('routes every owned skill in the generated catalog', () => {
    const catalog = readFileSync(resolve('SKILL-CATALOG.md'), 'utf8');

    expect(catalog).toContain('`vibe.spec` (global)');
    expect(catalog).not.toMatch(/`vibe(?:\.[^`]+)?` \(unrouted\)/);
  });
});

// 배치는 티어 상수가 SSOT 다 — 디렉토리가 상수를 따라야지, 테스트가 이름 목록을 들고 있지 않는다
// (CLAUDE.md "테스트는 불변식을 고정하고, 선택은 고정하지 않는다").
describe('skill tier boundary (SPEC skill-tier-boundary)', () => {
  it('REQ-skill-tier-boundary-001 places exactly EXTRA_SKILLS in skills-extra/ and exactly CORE_SKILLS in skills/', () => {
    const extraDirs = skillNamesIn(EXTRA_DIR).map(({ directory }): string => directory).sort();
    const coreDirs = skillNamesIn(CORE_DIR).map(({ directory }): string => directory).sort();

    expect(extraDirs).toEqual([...EXTRA_SKILLS]);
    expect(coreDirs).toEqual([...CORE_SKILLS]);
    expect(coreDirs.filter((name): boolean => extraDirs.includes(name))).toEqual([]);
  });

  it('REQ-skill-tier-boundary-001 derives EXTRA_SKILLS from the optional + capability tiers, not a hand-written list', () => {
    const derived = [...new Set([...GLOBAL_SKILLS_OPTIONAL, ...Object.values(CAPABILITY_SKILLS).flat()])].sort();

    expect([...EXTRA_SKILLS]).toEqual(derived);
    expect(EXTRA_SKILLS.some((name): boolean => GLOBAL_SKILLS.includes(name))).toBe(false);
  });

  it('REQ-skill-tier-boundary-002 moves vibe.educational-content from the global standard tier to the education capability', () => {
    expect(GLOBAL_SKILLS_STANDARD).not.toContain('vibe.educational-content');
    expect(CAPABILITY_SKILLS['education']).toEqual(['vibe.educational-content']);
    expect(AVAILABLE_CAPABILITIES.some((cap): boolean => cap.value === 'education')).toBe(true);
  });

  it('REQ-skill-tier-boundary-003 demotes every extras skill from the global install when both roots are shipped', () => {
    const shipped = SKILL_ROOTS.flatMap((dir): string[] =>
      readdirSync(resolve(dir), { withFileTypes: true })
        .filter((entry): boolean => entry.isDirectory())
        .map((entry): string => entry.name));
    const demoted = resolveDemotedGlobalSkills(shipped);

    expect(EXTRA_SKILLS.every((name): boolean => demoted.includes(name))).toBe(true);
    expect(demoted.some((name): boolean => GLOBAL_SKILLS.includes(name))).toBe(false);
  });
});
