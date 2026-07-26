import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'node:crypto';
import {
  applyCodexSkillInvocationPolicies,
  cleanupOptionalSkills,
  cleanupRenamedSkills,
  copySkillsFiltered,
  pruneExtraneousSkillFiles,
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

/**
 * 배송본에서 삭제·개명된 스킬 파일이 설치본에 영구 잔존하던 회귀를 막는다.
 *
 * 실제 사례(v3.2.10 배포 후 도그푸딩에서 발견): `references/ralph-loop.md` 와
 * `references/ultrawork-mode.md` 를 내용 모순 때문에 삭제하고 새 파일로 교체했는데,
 * `vibe upgrade` 후에도 두 구 파일이 `~/.claude/skills/` 와 `~/.codex/skills/` 에
 * 남아 있었다. 스킬 문서는 모델이 읽는 계약이므로 철회한 계약이 살아있는 셈이었다.
 */
describe('pruneExtraneousSkillFiles', () => {
  function makePair(): { src: string; dest: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-prune-'));
    const src = path.join(root, 'src');
    const dest = path.join(root, 'dest');
    fs.mkdirSync(path.join(src, 'references'), { recursive: true });
    fs.mkdirSync(path.join(dest, 'references'), { recursive: true });
    return { src, dest };
  }

  it('removes a file that no longer ships', () => {
    const { src, dest } = makePair();
    fs.writeFileSync(path.join(src, 'SKILL.md'), 'new');
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'old');
    fs.writeFileSync(path.join(dest, 'references', 'ralph-loop.md'), 'retracted');

    const removed = pruneExtraneousSkillFiles(src, dest);

    expect(removed).toContain(path.join('references', 'ralph-loop.md'));
    expect(fs.existsSync(path.join(dest, 'references', 'ralph-loop.md'))).toBe(false);
    // 배송본에 있는 파일은 건드리지 않는다
    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
  });

  it('removes a whole directory that no longer ships', () => {
    const { src, dest } = makePair();
    fs.mkdirSync(path.join(dest, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'agents', 'gone.md'), 'x');

    const removed = pruneExtraneousSkillFiles(src, dest);

    expect(removed).toContain('agents');
    expect(fs.existsSync(path.join(dest, 'agents'))).toBe(false);
  });

  it('is a no-op when dest mirrors src', () => {
    const { src, dest } = makePair();
    fs.writeFileSync(path.join(src, 'SKILL.md'), 'a');
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'a');

    expect(pruneExtraneousSkillFiles(src, dest)).toEqual([]);
  });

  it('tolerates a missing dest', () => {
    const { src } = makePair();
    expect(pruneExtraneousSkillFiles(src, path.join(src, '..', 'nope'))).toEqual([]);
  });
});

describe('copySkillsFiltered prunes stale files', () => {
  it('replaces a renamed reference instead of leaving both', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-copyprune-'));
    const src = path.join(root, 'pkg-skills');
    const dest = path.join(root, 'installed-skills');

    // 배송본: 새 이름만 존재
    fs.mkdirSync(path.join(src, 'vibe.run', 'references'), { recursive: true });
    fs.writeFileSync(path.join(src, 'vibe.run', 'SKILL.md'), 'skill');
    fs.writeFileSync(path.join(src, 'vibe.run', 'references', 'automation-level.md'), 'new');

    // 설치본: 구 이름이 남아 있는 상태
    fs.mkdirSync(path.join(dest, 'vibe.run', 'references'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'vibe.run', 'SKILL.md'), 'stale');
    fs.writeFileSync(path.join(dest, 'vibe.run', 'references', 'ultrawork-mode.md'), 'retracted');

    const pruned = copySkillsFiltered(src, dest, ['vibe.run']);

    expect(pruned).toContain(path.join('vibe.run', 'references', 'ultrawork-mode.md'));
    const refs = fs.readdirSync(path.join(dest, 'vibe.run', 'references'));
    expect(refs).toEqual(['automation-level.md']);
  });

  it('does not touch skills outside the allowed list', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-copyprune-scope-'));
    const src = path.join(root, 'pkg-skills');
    const dest = path.join(root, 'installed-skills');
    fs.mkdirSync(path.join(src, 'vibe.run'), { recursive: true });
    fs.writeFileSync(path.join(src, 'vibe.run', 'SKILL.md'), 'skill');
    fs.mkdirSync(path.join(dest, 'user-own-skill'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'user-own-skill', 'SKILL.md'), 'mine');

    copySkillsFiltered(src, dest, ['vibe.run']);

    expect(fs.existsSync(path.join(dest, 'user-own-skill', 'SKILL.md'))).toBe(true);
  });
});

/**
 * vibe 가 설치 후 생성하는 산출물(`agents/openai.yaml`)은 배송본에 없다.
 * prune 이 이를 지우면 매 upgrade 마다 삭제→재생성이 반복되고, "정리했다" 보고가
 * 철회된 문서가 아니라 vibe 자신의 생성물을 가리켜 노이즈가 된다.
 */
describe('pruneExtraneousSkillFiles — vibe 생성물 보존', () => {
  const MANAGED = '# VIBE managed Codex skill policy\npolicy:\n  allow_implicit_invocation: false\n';

  function makePair(): { src: string; dest: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-prune-gen-'));
    const src = path.join(root, 'src');
    const dest = path.join(root, 'dest');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(dest, { recursive: true });
    return { src, dest };
  }

  it('keeps a managed codex policy file that the package does not ship', () => {
    const { src, dest } = makePair();
    fs.mkdirSync(path.join(dest, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'agents', 'openai.yaml'), MANAGED);

    const removed = pruneExtraneousSkillFiles(src, dest);

    expect(removed).toEqual([]);
    expect(fs.existsSync(path.join(dest, 'agents', 'openai.yaml'))).toBe(true);
  });

  it('still removes an unmanaged file sitting next to a managed one', () => {
    const { src, dest } = makePair();
    fs.mkdirSync(path.join(dest, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'agents', 'openai.yaml'), MANAGED);
    fs.writeFileSync(path.join(dest, 'references-stale.md'), 'retracted');

    const removed = pruneExtraneousSkillFiles(src, dest);

    expect(removed).toEqual(['references-stale.md']);
    expect(fs.existsSync(path.join(dest, 'agents', 'openai.yaml'))).toBe(true);
  });

  it('removes a directory whose contents are not vibe-generated', () => {
    const { src, dest } = makePair();
    fs.mkdirSync(path.join(dest, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'agents', 'openai.yaml'), MANAGED);
    fs.writeFileSync(path.join(dest, 'agents', 'handwritten.yaml'), 'not managed');

    const removed = pruneExtraneousSkillFiles(src, dest);

    // 섞여 있으면 디렉토리를 통째로 지우지 않는다 — 내부만 정리한다
    expect(removed).toEqual([path.join('agents', 'handwritten.yaml')]);
    expect(fs.existsSync(path.join(dest, 'agents', 'openai.yaml'))).toBe(true);
  });

  it('removes an empty extraneous directory', () => {
    const { src, dest } = makePair();
    fs.mkdirSync(path.join(dest, 'empty'), { recursive: true });

    expect(pruneExtraneousSkillFiles(src, dest)).toEqual(['empty']);
  });
});
