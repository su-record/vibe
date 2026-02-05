import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadSkillMetadataOnly,
  loadSkillBody,
  scoreSkillMatch,
  listSkillResources,
  parseSkillFrontmatter,
} from '../skill-injector.js';

// ============================================
// loadSkillMetadataOnly
// ============================================

describe('loadSkillMetadataOnly', () => {
  const tmpDir = path.join(os.tmpdir(), 'skill-injector-test-' + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  it('should parse frontmatter with string, array, and number fields', () => {
    const skillPath = path.join(tmpDir, 'test-skill.md');
    fs.writeFileSync(skillPath, `---
name: test-skill
description: A test skill
triggers: [build, compile, deploy]
tier: 2
maxBodyTokens: 500
---
# Body content here
`);

    const meta = loadSkillMetadataOnly(skillPath);
    expect(meta).not.toBeNull();
    expect(meta.name).toBe('test-skill');
    expect(meta.description).toBe('A test skill');
    expect(meta.triggers).toEqual(['build', 'compile', 'deploy']);
    expect(meta.tier).toBe(2);
    expect(meta.maxBodyTokens).toBe(500);
  });

  it('should return null for non-frontmatter files', () => {
    const skillPath = path.join(tmpDir, 'no-frontmatter.md');
    fs.writeFileSync(skillPath, '# Just a markdown file\nNo frontmatter here.');

    const meta = loadSkillMetadataOnly(skillPath);
    expect(meta).toBeNull();
  });

  it('should return null for nonexistent files', () => {
    const meta = loadSkillMetadataOnly(path.join(tmpDir, 'nonexistent.md'));
    expect(meta).toBeNull();
  });

  it('should parse quoted string values', () => {
    const skillPath = path.join(tmpDir, 'quoted.md');
    fs.writeFileSync(skillPath, `---
name: "quoted-skill"
description: 'single quoted'
---
body
`);

    const meta = loadSkillMetadataOnly(skillPath);
    expect(meta.name).toBe('quoted-skill');
    expect(meta.description).toBe('single quoted');
  });

  it('should parse os array field', () => {
    const skillPath = path.join(tmpDir, 'os-skill.md');
    fs.writeFileSync(skillPath, `---
name: platform-specific
os: [darwin, linux]
requires: [ffmpeg, imagemagick]
---
body
`);

    const meta = loadSkillMetadataOnly(skillPath);
    expect(meta.os).toEqual(['darwin', 'linux']);
    expect(meta.requires).toEqual(['ffmpeg', 'imagemagick']);
  });
});

// ============================================
// loadSkillBody
// ============================================

describe('loadSkillBody', () => {
  const tmpDir = path.join(os.tmpdir(), 'skill-body-test-' + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  it('should extract body after frontmatter', () => {
    const skillPath = path.join(tmpDir, 'with-body.md');
    fs.writeFileSync(skillPath, `---
name: test
---
# Skill Body

Instructions here.`);

    const body = loadSkillBody(skillPath);
    expect(body).toBe('# Skill Body\n\nInstructions here.');
  });

  it('should return full content if no frontmatter', () => {
    const skillPath = path.join(tmpDir, 'no-fm.md');
    fs.writeFileSync(skillPath, '# Just content\nNo frontmatter.');

    const body = loadSkillBody(skillPath);
    expect(body).toBe('# Just content\nNo frontmatter.');
  });

  it('should return empty string for nonexistent files', () => {
    const body = loadSkillBody(path.join(tmpDir, 'nope.md'));
    expect(body).toBe('');
  });
});

// ============================================
// scoreSkillMatch
// ============================================

describe('scoreSkillMatch', () => {
  it('should return 0 for no triggers', () => {
    expect(scoreSkillMatch([], 'build the project')).toBe(0);
    expect(scoreSkillMatch(null, 'build the project')).toBe(0);
  });

  it('should score partial match (substring)', () => {
    const score = scoreSkillMatch(['build'], 'rebuild the project');
    expect(score).toBeGreaterThan(0);
  });

  it('should score higher for word boundary match', () => {
    const partialScore = scoreSkillMatch(['build'], 'rebuild the project');
    const exactScore = scoreSkillMatch(['build'], 'build the project');
    expect(exactScore).toBeGreaterThan(partialScore);
  });

  it('should accumulate scores for multiple trigger matches', () => {
    const singleScore = scoreSkillMatch(['build'], 'build and deploy');
    const doubleScore = scoreSkillMatch(['build', 'deploy'], 'build and deploy');
    expect(doubleScore).toBeGreaterThan(singleScore);
  });

  it('should be case insensitive', () => {
    const score = scoreSkillMatch(['BUILD'], 'build the project');
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================
// listSkillResources
// ============================================

describe('listSkillResources', () => {
  const tmpDir = path.join(os.tmpdir(), 'skill-resources-test-' + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  it('should list files from scripts/, references/, assets/ subdirs', () => {
    const scriptsDir = path.join(tmpDir, 'scripts');
    const assetsDir = path.join(tmpDir, 'assets');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'run.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(assetsDir, 'logo.png'), 'fake-png');

    const resources = listSkillResources(tmpDir);
    expect(resources).toContain('scripts/run.sh');
    expect(resources).toContain('assets/logo.png');
  });

  it('should return empty array for dir without subdirs', () => {
    const emptyDir = path.join(tmpDir, 'empty-skill');
    fs.mkdirSync(emptyDir, { recursive: true });

    const resources = listSkillResources(emptyDir);
    expect(resources).toEqual([]);
  });

  it('should skip hidden files', () => {
    const scriptsDir = path.join(tmpDir, 'scripts2');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, '.hidden'), 'secret');
    fs.writeFileSync(path.join(scriptsDir, 'visible.sh'), 'ok');

    const parentDir = path.join(tmpDir, 'skip-hidden');
    fs.mkdirSync(parentDir, { recursive: true });
    // Create scripts subdir under parent
    const parentScripts = path.join(parentDir, 'scripts');
    fs.mkdirSync(parentScripts, { recursive: true });
    fs.writeFileSync(path.join(parentScripts, '.hidden'), 'secret');
    fs.writeFileSync(path.join(parentScripts, 'visible.sh'), 'ok');

    const resources = listSkillResources(parentDir);
    expect(resources).toContain('scripts/visible.sh');
    expect(resources).not.toContain('scripts/.hidden');
  });
});

// ============================================
// parseSkillFrontmatter (backward compat)
// ============================================

describe('parseSkillFrontmatter', () => {
  it('should parse frontmatter and return metadata + template', () => {
    const content = `---
name: legacy-skill
triggers: [test, verify]
---
# Legacy body content`;

    const result = parseSkillFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result.metadata.name).toBe('legacy-skill');
    expect(result.metadata.triggers).toEqual(['test', 'verify']);
    expect(result.template).toBe('# Legacy body content');
  });

  it('should return null for non-frontmatter content', () => {
    const result = parseSkillFrontmatter('# No frontmatter');
    expect(result).toBeNull();
  });
});
