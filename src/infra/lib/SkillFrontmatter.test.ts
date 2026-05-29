import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSkillFile, parseSkillFrontmatter } from './SkillFrontmatter.js';

const ROOT = process.cwd();
const SKILLS_DIR = join(ROOT, 'skills');

function listSkillFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSkillFiles(fullPath));
      continue;
    }

    if (entry.name === 'SKILL.md') {
      files.push(fullPath);
    }
  }

  return files;
}

function extractFrontmatter(content: string): string | null {
  if (!content.startsWith('---\n')) return null;

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) return null;

  return content.slice(4, endIndex);
}

function findSplitQuotedScalars(): string[] {
  const issues: string[] = [];
  const splitQuotedScalar = /^[A-Za-z0-9_-]+:\s*"[^"]*"\s+\S/;

  for (const filePath of listSkillFiles(SKILLS_DIR)) {
    const frontmatter = extractFrontmatter(readFileSync(filePath, 'utf8'));
    if (!frontmatter) continue;

    frontmatter.split('\n').forEach((line, index) => {
      if (splitQuotedScalar.test(line)) {
        issues.push(`${relative(ROOT, filePath)}:${index + 2}:${line}`);
      }
    });
  }

  return issues;
}

describe('SkillFrontmatter', () => {
  it('escapes quotes in generated scalar values', () => {
    const content = createSkillFile({
      name: 'demo-skill',
      description: 'Say "hello"',
      argumentHint: '"feature name" or --phase N',
    }, '# Demo');

    expect(content).toContain('description: "Say \\"hello\\""');
    expect(content).toContain('argument-hint: "\\"feature name\\" or --phase N"');
    expect(parseSkillFrontmatter(content)?.metadata.description).toBe('Say "hello"');
    expect(parseSkillFrontmatter(content)?.metadata.argumentHint).toBe('"feature name" or --phase N');
  });

  it('keeps bundled SKILL.md frontmatter valid for quoted hints', () => {
    expect(findSplitQuotedScalars()).toEqual([]);
  });
});
