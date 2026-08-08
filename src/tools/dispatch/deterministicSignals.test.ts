/**
 * 디스패처 결정론 신호 테스트.
 *
 * 이 신호들은 원래 `/vibe` SKILL.md 의 마크다운 표를 모델이 읽어 판단하던 것이다.
 * 코드로 내린 이상, 하네스와 무관하게 같은 답이 나오는지 여기서 고정한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  collectDispatchSignals,
  detectResumeState,
  detectStakesSignals,
  classifyUrl,
  classifyAttachment,
} from './deterministicSignals.js';

let dir: string;

const write = (rel: string, content = ''): void => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-dispatch-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('detectResumeState', () => {
  it('아무 산출물도 없으면 none', () => {
    const r = detectResumeState(dir);
    expect(r.resumeFrom).toBe('none');
    expect(r.feature).toBeNull();
  });

  it('.last-feature 로 feature 를 해석한다', () => {
    write('.vibe/.last-feature', 'login\n');
    write('.vibe/specs/login.md', '# SPEC');

    const r = detectResumeState(dir);
    expect(r.lastFeature).toBe('login');
    expect(r.specPath).toBe(path.join('.vibe', 'specs', 'login.md'));
    expect(r.resumeFrom).toBe('run');
  });

  it('인자 feature 가 .last-feature 보다 우선한다', () => {
    write('.vibe/.last-feature', 'login\n');
    write('.vibe/specs/signup.md', '# SPEC');

    expect(detectResumeState(dir, 'signup').specPath).toBe(path.join('.vibe', 'specs', 'signup.md'));
  });

  it('분할 SPEC 은 _index.md 로 해석한다', () => {
    write('.vibe/specs/checkout/_index.md', '# index');
    expect(detectResumeState(dir, 'checkout').specPath)
      .toBe(path.join('.vibe', 'specs', 'checkout', '_index.md'));
  });

  it('feature 파일도 함께 찾는다', () => {
    write('.vibe/specs/login.md', '# SPEC');
    write('.vibe/features/login.feature', 'Feature: login');

    const r = detectResumeState(dir, 'login');
    expect(r.featurePath).toBe(path.join('.vibe', 'features', 'login.feature'));
  });

  it('레거시 산출물은 별도로 보고한다 (재생성 금지 대상)', () => {
    write('.vibe/plans/login.md', '# plan');
    write('.vibe/interviews/login.md', '# interview');

    const r = detectResumeState(dir, 'login');
    expect(r.legacyArtifacts).toHaveLength(2);
    // SPEC 이 아니므로 resume 은 여전히 none
    expect(r.resumeFrom).toBe('none');
  });
});

describe('detectStakesSignals', () => {
  it('config 없는 임시 디렉토리를 신호로 잡는다', () => {
    const s = detectStakesSignals(dir);
    expect(s.hasVibeConfig).toBe(false);
    expect(s.isTempDir).toBe(true);
    expect(s.isGitRepo).toBe(false);
  });

  it('config 와 git 이 있으면 기존 프로젝트로 본다', () => {
    write('.vibe/config.json', '{}');
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });

    const s = detectStakesSignals(dir);
    expect(s.hasVibeConfig).toBe(true);
    expect(s.isGitRepo).toBe(true);
  });
});

describe('classifyUrl', () => {
  it.each([
    ['https://figma.com/file/abc', 'figma'],
    ['https://www.figma.com/design/abc', 'figma'],
    ['https://github.com/su-record/vibe', 'github'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://example.com/page', 'web'],
  ])('%s → %s', (url, kind) => {
    expect(classifyUrl(url)).toBe(kind);
  });

  it('호스트 접미사만 같은 도메인을 오분류하지 않는다', () => {
    // notfigma.com 은 figma 가 아니다 — endsWith 를 '.figma.com' 으로 건 이유
    expect(classifyUrl('https://notfigma.com/x')).toBe('web');
    expect(classifyUrl('https://evil-github.com/x')).toBe('web');
  });

  it('URL 이 아니면 web 으로 떨어진다', () => {
    expect(classifyUrl('not a url')).toBe('web');
  });
});

describe('classifyAttachment', () => {
  it.each([
    ['.vibe/specs/login.md', 'spec'],
    ['login.feature', 'feature'],
    ['docs/prd.pdf', 'document'],
    ['mock.png', 'image'],
    ['src/index.ts', 'code'],
    ['data.bin', 'unknown'],
  ])('%s → %s', (p, kind) => {
    expect(classifyAttachment(p)).toBe(kind);
  });

  it('specs 밖의 .md 는 spec 이 아니라 document 다', () => {
    expect(classifyAttachment('README.md')).toBe('document');
  });
});

describe('collectDispatchSignals', () => {
  it('신호를 한 묶음으로 확정한다', () => {
    write('.vibe/config.json', '{}');
    write('.vibe/specs/login.md', '# SPEC');
    write('mock.png', 'x');

    const s = collectDispatchSignals(dir, {
      urls: ['https://figma.com/file/abc', 'https://example.com'],
      attachments: ['mock.png', 'missing.pdf'],
      feature: 'login',
    });

    expect(s.resume.resumeFrom).toBe('run');
    expect(s.stakes.hasVibeConfig).toBe(true);
    expect(s.urls.map(u => u.kind)).toEqual(['figma', 'web']);
    expect(s.attachments[0]).toMatchObject({ kind: 'image', exists: true });
    expect(s.attachments[1]).toMatchObject({ kind: 'document', exists: false });
  });

  it('입력이 없어도 동작한다', () => {
    const s = collectDispatchSignals(dir);
    expect(s.urls).toEqual([]);
    expect(s.attachments).toEqual([]);
  });
});
