import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_SKILLS,
  GLOBAL_SKILLS,
  GLOBAL_SKILLS_OPTIONAL,
  STACK_TO_SKILLS,
} from '../cli/postinstall/constants.js';

const SKILLS_DIR = resolve('skills');
const MAX_SKILL_NAME_LENGTH = 32;

function skillNames(): Array<{ directory: string; name: string }> {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry): boolean =>
      entry.isDirectory() && existsSync(resolve(SKILLS_DIR, entry.name, 'SKILL.md')))
    .map((entry): { directory: string; name: string } => {
      const content = readFileSync(resolve(SKILLS_DIR, entry.name, 'SKILL.md'), 'utf8');
      const name = /^name:\s*(.+)$/m.exec(content)?.[1]?.trim() ?? '';
      return { directory: entry.name, name };
    });
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

  it('keeps directory names and frontmatter names unique and identical', () => {
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
