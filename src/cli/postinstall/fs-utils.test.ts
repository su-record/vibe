import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'node:crypto';
import {
  applyCodexSkillInvocationPolicies,
  cleanupOptionalSkills,
  cleanupRenamedSkills,
} from './fs-utils.js';

function writeSkill(root: string, name: string, frontmatter: string): string {
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name}\n${frontmatter}---\n\nBody\n`,
  );
  return skillDir;
}

function skillContent(name: string): string {
  return `---\nname: ${name}\ndescription: ${name}\n---\n\nBody\n`;
}

describe('postinstall fs-utils', () => {
  it('disables implicit Codex invocation for internal skills only', () => {
    const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-skills-'));
    const internalDir = writeSkill(skillsDir, 'interview', 'user-invocable: false\n');
    const entryDir = writeSkill(skillsDir, 'vibe.spec', 'user-invocable: true\n');

    applyCodexSkillInvocationPolicies(skillsDir);

    const internalPolicy = fs.readFileSync(path.join(internalDir, 'agents', 'openai.yaml'), 'utf-8');
    expect(internalPolicy).toContain('allow_implicit_invocation: false');
    expect(fs.existsSync(path.join(entryDir, 'agents', 'openai.yaml'))).toBe(false);
  });

  it('removes stale managed Codex policy when a skill becomes user-invocable', () => {
    const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-skills-'));
    const skillDir = writeSkill(skillsDir, 'vibe.run', 'user-invocable: false\n');

    applyCodexSkillInvocationPolicies(skillsDir);
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: vibe.run\ndescription: run\nuser-invocable: true\n---\n\nBody\n',
    );
    applyCodexSkillInvocationPolicies(skillsDir);

    expect(fs.existsSync(path.join(skillDir, 'agents', 'openai.yaml'))).toBe(false);
  });
});

describe('cleanupOptionalSkills', () => {
  const OPTIONAL = ['vibe.commit-push-pr', 'vibe.git-worktree', 'vibe.tool-fallback', 'vibe.context7-usage'];

  function setupDirs(): { globalSkillsDir: string; shippedSkillsDir: string } {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-optional-'));
    return {
      globalSkillsDir: path.join(base, 'global'),
      shippedSkillsDir: path.join(base, 'shipped'),
    };
  }

  it('removes vibe-owned optional skill when content matches shipped version', () => {
    const { globalSkillsDir, shippedSkillsDir } = setupDirs();
    const skillName = 'vibe.commit-push-pr';
    const content = skillContent(skillName);

    // 설치된 스킬 (shipped와 동일)
    const installDir = path.join(globalSkillsDir, skillName);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, 'SKILL.md'), content);

    // shipped 스킬
    const shippedDir = path.join(shippedSkillsDir, skillName);
    fs.mkdirSync(shippedDir, { recursive: true });
    fs.writeFileSync(path.join(shippedDir, 'SKILL.md'), content);

    const results = cleanupOptionalSkills(globalSkillsDir, OPTIONAL, shippedSkillsDir);

    expect(results[0].action).toBe('removed');
    expect(fs.existsSync(installDir)).toBe(false);
  });

  it('preserves user-modified optional skill and returns skipped-user-modified', () => {
    const { globalSkillsDir, shippedSkillsDir } = setupDirs();
    const skillName = 'vibe.git-worktree';

    const installDir = path.join(globalSkillsDir, skillName);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, 'SKILL.md'), skillContent(skillName) + '\n## User Added Section\n');

    const shippedDir = path.join(shippedSkillsDir, skillName);
    fs.mkdirSync(shippedDir, { recursive: true });
    fs.writeFileSync(path.join(shippedDir, 'SKILL.md'), skillContent(skillName));

    const results = cleanupOptionalSkills(globalSkillsDir, OPTIONAL, shippedSkillsDir);
    const result = results.find(r => r.name === skillName);

    expect(result?.action).toBe('skipped-user-modified');
    expect(fs.existsSync(installDir)).toBe(true);
  });

  it('skips skill whose SKILL.md name does not match directory name', () => {
    const { globalSkillsDir, shippedSkillsDir } = setupDirs();
    const skillName = 'vibe.tool-fallback';

    // name이 디렉토리명과 다름 → not vibe-owned
    const installDir = path.join(globalSkillsDir, skillName);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(
      path.join(installDir, 'SKILL.md'),
      '---\nname: something-else\ndescription: custom\n---\n\nBody\n',
    );

    const results = cleanupOptionalSkills(globalSkillsDir, OPTIONAL, shippedSkillsDir);
    const result = results.find(r => r.name === skillName);

    expect(result?.action).toBe('skipped-not-vibe');
    expect(fs.existsSync(installDir)).toBe(true);
  });

  it('dryRun=true returns removed action without deleting directory', () => {
    const { globalSkillsDir, shippedSkillsDir } = setupDirs();
    const skillName = 'vibe.context7-usage';
    const content = skillContent(skillName);

    const installDir = path.join(globalSkillsDir, skillName);
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, 'SKILL.md'), content);

    const shippedDir = path.join(shippedSkillsDir, skillName);
    fs.mkdirSync(shippedDir, { recursive: true });
    fs.writeFileSync(path.join(shippedDir, 'SKILL.md'), content);

    const results = cleanupOptionalSkills(globalSkillsDir, OPTIONAL, shippedSkillsDir, true);
    const result = results.find(r => r.name === skillName);

    expect(result?.action).toBe('removed');
    expect(fs.existsSync(installDir)).toBe(true); // dryRun이므로 실제 삭제 없음
  });
});

describe('cleanupRenamedSkills', () => {
  const RENAMES = { spec: 'vibe.spec' } as const;

  function setupRename(contentSuffix = ''): { globalSkillsDir: string; hashes: Record<string, string> } {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-renamed-'));
    const globalSkillsDir = path.join(base, 'global');
    const installedDir = path.join(globalSkillsDir, 'spec');
    fs.mkdirSync(installedDir, { recursive: true });
    const original = skillContent('spec');
    fs.writeFileSync(path.join(installedDir, 'SKILL.md'), original + contentSuffix);
    const hash = createHash('sha256').update(original).digest('hex');
    return { globalSkillsDir, hashes: { spec: hash } };
  }

  it('REQ-skill-namespace-004 removes an unchanged legacy Vibe skill', () => {
    const { globalSkillsDir, hashes } = setupRename();

    const results = cleanupRenamedSkills(globalSkillsDir, RENAMES, hashes);

    expect(results).toContainEqual(expect.objectContaining({ name: 'spec', action: 'removed' }));
    expect(fs.existsSync(path.join(globalSkillsDir, 'spec'))).toBe(false);
  });

  it('preserves a user-modified legacy skill', () => {
    const { globalSkillsDir, hashes } = setupRename('\n## User content\n');

    const results = cleanupRenamedSkills(globalSkillsDir, RENAMES, hashes);

    expect(results).toContainEqual(expect.objectContaining({ name: 'spec', action: 'skipped-user-modified' }));
    expect(fs.existsSync(path.join(globalSkillsDir, 'spec'))).toBe(true);
  });

  it('preserves a directory whose frontmatter name does not match', () => {
    const { globalSkillsDir, hashes } = setupRename();
    fs.writeFileSync(
      path.join(globalSkillsDir, 'spec', 'SKILL.md'),
      skillContent('custom-spec'),
    );

    const results = cleanupRenamedSkills(globalSkillsDir, RENAMES, hashes);

    expect(results).toContainEqual(expect.objectContaining({ name: 'spec', action: 'skipped-not-vibe' }));
    expect(fs.existsSync(path.join(globalSkillsDir, 'spec'))).toBe(true);
  });
});
