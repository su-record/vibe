/**
 * clone-merge-responsive — MO/PC SCSS → mobile-first 병합
 *   - mergeRules/emitMerged: 순수 병합 코어
 *   - CLI: fixture 디렉토리 → sections/tokens/index/class-plan 병합 산출
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { mergeRules, emitMerged } from '../clone-merge-responsive.js';
import { parseScss } from '../clone-validate.js';

const SCRIPT = fileURLToPath(new URL('../clone-merge-responsive.js', import.meta.url));

const MO = `.f__hero { display: flex; flex-direction: column; padding-top: 24px; }
.f__hero__title { font-size: 28px; color: rgb(0, 0, 0); }`;

const PC = `.f__hero { display: flex; flex-direction: row; padding-top: 64px; }
.f__hero__title { font-size: 48px; color: rgb(0, 0, 0); }
.f__hero__side { width: 320px; }`;

describe('mergeRules', () => {
  const { base, media, stats } = mergeRules(parseScss(MO), parseScss(PC));

  it('keeps MO declarations as the mobile-first base', () => {
    expect(base.get('.f__hero')).toEqual({
      display: 'flex', 'flex-direction': 'column', 'padding-top': '24px',
    });
  });

  it('puts only differing PC declarations into the media bucket', () => {
    expect(media.get('.f__hero')).toEqual({ 'flex-direction': 'row', 'padding-top': '64px' });
    // color는 양쪽 동일 → media에서 제외
    expect(media.get('.f__hero__title')).toEqual({ 'font-size': '48px' });
  });

  it('moves PC-only selectors wholly into the media bucket', () => {
    expect(base.has('.f__hero__side')).toBe(false);
    expect(media.get('.f__hero__side')).toEqual({ width: '320px' });
    expect(stats.pcOnly).toBe(1);
  });
});

describe('emitMerged', () => {
  it('emits base + a single min-width block without duplicating shared declarations', () => {
    const { scss } = emitMerged(parseScss(MO), parseScss(PC), 1024, '// merged');
    expect(scss).toContain('@media (min-width: 1024px)');
    expect(scss.match(/@media/g)).toHaveLength(1);
    // 양 BP 동일 선언은 base에 1번만 등장
    expect(scss.match(/display: flex;/g)).toHaveLength(1);
    expect(scss.match(/color: rgb\(0, 0, 0\);/g)).toHaveLength(1);
  });

  it('omits the media block when PC has no differences', () => {
    const { scss } = emitMerged(parseScss(MO), parseScss(MO), 1024, '// same');
    expect(scss).not.toContain('@media');
  });
});

describe('CLI file-level merge', () => {
  const write = (dir, rel, content) => {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  };

  it('merges section dirs and writes index/tokens/class-plan', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-merge-'));
    const mo = path.join(tmp, 'mo');
    const pc = path.join(tmp, 'pc');
    const out = path.join(tmp, 'merged');
    write(mo, 'sections/_hero.scss', MO);
    write(pc, 'sections/_hero.scss', PC);
    write(pc, 'sections/_footer.scss', '.f__footer { height: 200px; }'); // PC 전용 섹션
    write(mo, '_tokens.scss', ':root { --c-1: #000; --sp-1: 16px; }');
    write(pc, '_tokens.scss', ':root { --c-1: #000; --sp-1: 32px; }');
    write(mo, 'class-plan.json', JSON.stringify({ 0: 'f__hero' }));
    write(pc, 'class-plan.json', JSON.stringify({ 0: 'f__hero', 0.9: 'f__footer' }));

    execFileSync('node', [SCRIPT, `--mo=${mo}`, `--pc=${pc}`, `--out=${out}`, '--breakpoint=1024']);

    const hero = fs.readFileSync(path.join(out, 'sections/_hero.scss'), 'utf8');
    expect(hero).toContain('flex-direction: column');
    expect(hero).toContain('@media (min-width: 1024px)');

    // PC 전용 섹션 파일은 통째로 media 블록 안
    const footer = fs.readFileSync(path.join(out, 'sections/_footer.scss'), 'utf8');
    expect(footer).toContain('@media (min-width: 1024px)');
    expect(footer).toContain('height: 200px');

    const tokens = fs.readFileSync(path.join(out, '_tokens.scss'), 'utf8');
    expect(tokens).toContain('--sp-1: 16px'); // base = MO
    expect(tokens).toContain('--sp-1: 32px'); // PC diff → media

    const index = fs.readFileSync(path.join(out, 'index.scss'), 'utf8');
    expect(index).toContain(`@use './sections/hero'`);
    expect(index).toContain(`@use './sections/footer'`);

    const plan = JSON.parse(fs.readFileSync(path.join(out, 'class-plan.json'), 'utf8'));
    expect(plan['0']).toBe('f__hero');
    expect(plan['0.9']).toBe('f__footer');
  });
});
