import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseSections,
  lintMissingSections,
  extractHexTokens,
  findHardcodedColors,
  STITCH_SECTIONS,
} from './design-md-parser.js';

const ROOT = process.cwd();
const TEMPLATE_PATH = join(ROOT, 'skills/vibe.design/templates/DESIGN.md.template');
const SKILL_PATH = join(ROOT, 'skills/vibe.design/SKILL.md');
const REFS_PATH = join(ROOT, 'skills/vibe.design/references/README.md');
const HEUR_PATH = join(ROOT, 'skills/vibe.design/heuristics/code-extract.md');

const template = readFileSync(TEMPLATE_PATH, 'utf8');

describe('design-md-parser: parseSections', () => {
  it('finds all 9 Stitch sections in the template', () => {
    const sections = parseSections(template);
    expect(sections).toHaveLength(9);
    expect(sections.map((s: { title: string }) => s.title)).toEqual([...STITCH_SECTIONS]);
  });

  it('ignores non-Stitch H2 headings', () => {
    const md = '## Random Other Section\nfoo\n## Color Palette\n- #FFF\n';
    const sections = parseSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Color Palette');
  });

  it('captures section body between H2 headings', () => {
    const md = '## Visual Theme\nBrand tone here\n\n## Color Palette\n- #000\n';
    const sections = parseSections(md);
    expect(sections[0].body).toBe('Brand tone here');
  });
});

describe('design-md-parser: lintMissingSections', () => {
  it('returns empty array for the complete template', () => {
    expect(lintMissingSections(template)).toEqual([]);
  });

  it('lists missing sections for a partial DESIGN.md', () => {
    const partial = '## Visual Theme\nA\n## Color Palette\n- #000\n';
    const missing = lintMissingSections(partial);
    expect(missing).toContain('Typography');
    expect(missing).toContain('Responsive');
    expect(missing).toHaveLength(7);
  });

  it('returns all 9 for empty input', () => {
    expect(lintMissingSections('')).toHaveLength(9);
  });
});

describe('design-md-parser: extractHexTokens', () => {
  it('extracts hex colors only from Color Palette section', () => {
    const md = [
      '## Visual Theme',
      'use #DEADBE (outside palette - ignored)',
      '## Color Palette',
      '- Primary: #FF0000',
      '- Secondary: #00ff00',
      '- Three: #abc',
      '## Typography',
      'family',
    ].join('\n');
    const hex = extractHexTokens(md);
    expect(hex).toEqual(expect.arrayContaining(['#ff0000', '#00ff00', '#abc']));
    expect(hex).not.toContain('#deadbe');
  });

  it('returns empty when Color Palette section is absent', () => {
    expect(extractHexTokens('## Visual Theme\nfoo')).toEqual([]);
  });

  it('deduplicates case-insensitively', () => {
    const md = '## Color Palette\n#FF0000 #ff0000 #Ff0000\n';
    expect(extractHexTokens(md)).toEqual(['#ff0000']);
  });
});

describe('design-md-parser: findHardcodedColors', () => {
  it('flags hex values not present in the allowed token set', () => {
    const files = [
      {
        path: 'src/Button.tsx',
        content: 'const bg = "#FF0000";\nconst fg = "#123456";\n',
      },
    ];
    const result = findHardcodedColors(files, ['#ff0000']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      file: 'src/Button.tsx',
      line: 2,
      hex: '#123456',
    });
  });

  it('returns empty when every hex is allowed', () => {
    const files = [{ path: 'a.css', content: 'color: #fff;\nbg: #ABCDEF;' }];
    const result = findHardcodedColors(files, ['#fff', '#abcdef']);
    expect(result).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const files = [{ path: 'x.ts', content: '"#aAbBcC"' }];
    expect(findHardcodedColors(files, ['#AABBCC'])).toEqual([]);
  });
});

describe('vibe.design static assets', () => {
  it('SKILL.md has frontmatter with name: vibe.design', () => {
    const skill = readFileSync(SKILL_PATH, 'utf8');
    expect(skill).toMatch(/^---\r?\n[\s\S]+?\r?\n---/);
    expect(skill).toMatch(/name:\s*vibe\.design/);
    expect(skill).toMatch(/user-invocable:\s*true/);
  });

  it('SKILL.md documents all 4 subcommands', () => {
    const skill = readFileSync(SKILL_PATH, 'utf8');
    expect(skill).toMatch(/init/);
    expect(skill).toMatch(/lint/);
    expect(skill).toMatch(/verify/);
    expect(skill).toMatch(/sync/);
  });

  it('template starts with version marker', () => {
    expect(template.split(/\r?\n/)[0]).toBe('<!-- design-md-version: 1 -->');
  });

  it('references catalog includes style-preset column and linear seed', () => {
    const refs = readFileSync(REFS_PATH, 'utf8');
    expect(refs).toMatch(/style-preset/i);
    expect(refs).toMatch(/linear/i);
  });

  it('heuristics doc lists v1 required patterns', () => {
    const heur = readFileSync(HEUR_PATH, 'utf8');
    expect(heur).toMatch(/Tailwind/);
    expect(heur).toMatch(/CSS custom properties|CSS-vars|CSS variables/i);
    expect(heur).toMatch(/styled-components/);
  });
});

describe('constants.ts SSOT registration', () => {
  const constantsPath = join(ROOT, 'src/cli/postinstall/constants.ts');
  const source = readFileSync(constantsPath, 'utf8');

  it('registers vibe.design in GLOBAL_SKILLS_ENTRY', () => {
    expect(source).toMatch(/'vibe\.design'/);
  });

  it('maps vibe.design to all 11 UI stacks', () => {
    const uiStacks = [
      'typescript-react',
      'typescript-nextjs',
      'typescript-vue',
      'typescript-nuxt',
      'typescript-svelte',
      'typescript-angular',
      'typescript-astro',
      'typescript-react-native',
      'dart-flutter',
      'swift-ios',
      'kotlin-android',
    ];
    for (const stack of uiStacks) {
      const re = new RegExp(`'${stack}':\\s*\\[[^\\]]*'vibe\\.design'[^\\]]*\\]`);
      expect(source).toMatch(re);
    }
  });
});
