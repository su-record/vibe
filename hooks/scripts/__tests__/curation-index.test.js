/**
 * curation-index.js — Phase 3 인덱스 로더 테스트
 *
 * session-start.js 가 다음 세션에 prepend 할 1줄 요약을 만드는 모듈.
 * 본격 YAML parser 의존 없이 우리가 작성한 frontmatter 형식만 처리한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadCurationIndex, _internal } from '../lib/curation-index.js';

const { parseFrontmatter } = _internal;

function makeTmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-curation-index-'));
}

function writeRecipe(projectDir, filename, frontmatter, body = 'body text') {
  const dir = path.join(projectDir, '.vibe', 'recipes');
  fs.mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => typeof v === 'string' ? `${k}: "${v}"` : `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(path.join(dir, filename), `---\n${fm}\n---\n\n${body}\n`);
}

function writeAntiPattern(projectDir, filename, frontmatter, body = 'body') {
  const dir = path.join(projectDir, '.vibe', 'anti-patterns');
  fs.mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => typeof v === 'string' ? `${k}: "${v}"` : `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(path.join(dir, filename), `---\n${fm}\n---\n\n${body}\n`);
}

describe('parseFrontmatter', () => {
  it('단순 key-value 파싱', () => {
    const input = `---\nslug: foo\ntype: recipe\n---\nbody`;
    expect(parseFrontmatter(input)).toEqual({ slug: 'foo', type: 'recipe' });
  });

  it('따옴표로 감싼 값', () => {
    const input = `---\nrecipe: "use claude --model"\n---\n`;
    expect(parseFrontmatter(input).recipe).toBe('use claude --model');
  });

  it('이스케이프된 따옴표', () => {
    const input = `---\nmsg: "say \\"hi\\""\n---\n`;
    expect(parseFrontmatter(input).msg).toBe('say "hi"');
  });

  it('frontmatter 가 없으면 null', () => {
    expect(parseFrontmatter('no frontmatter here')).toBeNull();
  });

  it('알 수 없는 라인 무시', () => {
    const input = `---\nslug: foo\n# comment line\nrandom garbage\ntype: recipe\n---\n`;
    expect(parseFrontmatter(input)).toEqual({ slug: 'foo', type: 'recipe' });
  });
});

describe('loadCurationIndex', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = makeTmpProject();
  });

  it('빈 .vibe/ 면 빈 인덱스', () => {
    const idx = loadCurationIndex(projectDir);
    expect(idx.recipes).toEqual([]);
    expect(idx.antiPatterns).toEqual([]);
  });

  it('recipe 1개 로드', () => {
    writeRecipe(projectDir, 'a.md', {
      slug: 'login__20260507-100000',
      type: 'recipe',
      'symptom-context': 'login flow',
      recipe: 'pin model and retry transient',
      created: '2026-05-07',
    });
    const idx = loadCurationIndex(projectDir);
    expect(idx.recipes).toHaveLength(1);
    expect(idx.recipes[0]).toEqual({
      slug: 'login__20260507-100000',
      summary: 'pin model and retry transient',
    });
  });

  it('recipe 정렬: created 내림차순', () => {
    writeRecipe(projectDir, 'old.md', { slug: 'old', recipe: 'old', created: '2026-01-01' });
    writeRecipe(projectDir, 'mid.md', { slug: 'mid', recipe: 'mid', created: '2026-03-01' });
    writeRecipe(projectDir, 'new.md', { slug: 'new', recipe: 'new', created: '2026-05-01' });
    const idx = loadCurationIndex(projectDir);
    expect(idx.recipes.map((r) => r.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('limit 적용', () => {
    for (let i = 0; i < 10; i++) {
      writeRecipe(projectDir, `r${i}.md`, {
        slug: `r${i}`,
        recipe: `recipe ${i}`,
        created: `2026-05-${String(i + 1).padStart(2, '0')}`,
      });
    }
    const idx = loadCurationIndex(projectDir, { recipeLimit: 3 });
    expect(idx.recipes).toHaveLength(3);
    expect(idx.recipes[0].slug).toBe('r9');
  });

  it('anti-pattern 로드 — tag + suggested-stop', () => {
    writeAntiPattern(projectDir, 'a.md', {
      slug: 'nullability__src__20260507',
      type: 'anti-pattern',
      'root-cause-tag': 'nullability',
      'trigger-signature': '(file=src/x.ts, category=nullability)',
      'suggested-stop': '같은 위치 null 처리 반복 — 타입 가드 필요',
      created: '2026-05-07',
    });
    const idx = loadCurationIndex(projectDir);
    expect(idx.antiPatterns).toHaveLength(1);
    expect(idx.antiPatterns[0].tag).toBe('nullability');
    expect(idx.antiPatterns[0].summary).toBe('같은 위치 null 처리 반복 — 타입 가드 필요');
  });

  it('frontmatter 손상 파일은 스킵', () => {
    writeRecipe(projectDir, 'good.md', { slug: 'good', recipe: 'works', created: '2026-05-07' });
    fs.writeFileSync(path.join(projectDir, '.vibe', 'recipes', 'broken.md'), 'no frontmatter');
    fs.writeFileSync(path.join(projectDir, '.vibe', 'recipes', 'no-slug.md'), '---\ntype: recipe\n---\n');
    const idx = loadCurationIndex(projectDir);
    expect(idx.recipes).toHaveLength(1);
    expect(idx.recipes[0].slug).toBe('good');
  });

  it('README.md, _cluster*.md 등 메타 파일 제외', () => {
    writeRecipe(projectDir, 'r.md', { slug: 'r', recipe: 'good', created: '2026-05-07' });
    fs.writeFileSync(path.join(projectDir, '.vibe', 'recipes', 'README.md'), '---\nslug: should-skip\n---\n');
    fs.writeFileSync(path.join(projectDir, '.vibe', 'recipes', '_cluster-x.md'), '---\nslug: should-skip\n---\n');
    const idx = loadCurationIndex(projectDir);
    expect(idx.recipes.map((r) => r.slug)).toEqual(['r']);
  });

  it('recipe + anti-pattern 동시 로드 (독립)', () => {
    writeRecipe(projectDir, 'r.md', { slug: 'r', recipe: 'do this', created: '2026-05-07' });
    writeAntiPattern(projectDir, 'a.md', {
      slug: 'a',
      'root-cause-tag': 'auth',
      'suggested-stop': 'check tokens',
      created: '2026-05-07',
    });
    const idx = loadCurationIndex(projectDir);
    expect(idx.recipes).toHaveLength(1);
    expect(idx.antiPatterns).toHaveLength(1);
  });
});
