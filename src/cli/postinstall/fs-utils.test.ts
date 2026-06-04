import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { applyCodexSkillInvocationPolicies } from './fs-utils.js';

function writeSkill(root: string, name: string, frontmatter: string): string {
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name}\n${frontmatter}---\n\nBody\n`,
  );
  return skillDir;
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
