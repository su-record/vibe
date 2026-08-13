/**
 * 플러그인 패키징 계약.
 *
 * vibe 는 npm 전역 설치와 플러그인 두 경로로 배포된다. 훅 정의가 **두 벌**인 것이
 * 이 계약의 핵심 위험이다:
 *
 *   hooks/hooks.json         npm 경로 — postinstall 이 `{{VIBE_PATH}}` 를 치환한다
 *   hooks/plugin-hooks.json  플러그인 경로 — 치환 단계가 없어 `${PLUGIN_ROOT}` 를 쓴다
 *
 * 둘이 갈라지면 한쪽 하네스에서만 가드가 죽는다 — 이번 세션 내내 반복해서 본 형태다.
 * 이벤트 집합과 경로 표기를 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(read(rel)) as Record<string, unknown>;

const manifest = readJson('.codex-plugin/plugin.json');
const pkg = readJson('package.json');

describe('plugin.json — 문서에 명시된 필수 필드', () => {
  it.each(['name', 'version', 'description'])('%s 가 있다', (field) => {
    expect(typeof manifest[field]).toBe('string');
    expect((manifest[field] as string).length).toBeGreaterThan(0);
  });

  it('name 은 kebab-case 다', () => {
    expect(manifest.name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('version 이 package.json 과 같다 — 배포 두 경로가 어긋나면 안 된다', () => {
    expect(manifest.version).toBe(pkg.version);
  });
});

describe('경로 규칙 — 문서: "must begin with ./ and remain within root"', () => {
  const pathFields = ['skills', 'hooks'] as const;

  it.each(pathFields)('%s 가 ./ 로 시작한다', (field) => {
    expect(manifest[field]).toMatch(/^\.\//);
  });

  it.each(pathFields)('%s 가 루트를 벗어나지 않는다', (field) => {
    const rel = manifest[field] as string;
    expect(rel).not.toContain('..');
    expect(path.resolve(ROOT, rel).startsWith(ROOT + path.sep)).toBe(true);
  });

  it.each(pathFields)('%s 가 실재한다', (field) => {
    expect(fs.existsSync(path.join(ROOT, manifest[field] as string))).toBe(true);
  });
});

describe('훅 정의 두 벌이 갈라지지 않는다', () => {
  const npmHooks = readJson('hooks/hooks.json').hooks as Record<string, unknown>;
  const pluginHooks = readJson('hooks/plugin-hooks.json').hooks as Record<string, unknown>;

  it('이벤트 집합이 같다', () => {
    expect(Object.keys(pluginHooks).sort()).toEqual(Object.keys(npmHooks).sort());
  });

  it('플러그인 쪽은 ${PLUGIN_ROOT} 를 쓴다 — 치환 단계가 없다', () => {
    const s = JSON.stringify(pluginHooks);
    expect(s).toContain('${PLUGIN_ROOT}');
    expect(s, '{{VIBE_PATH}} 는 postinstall 전용 — 플러그인에서는 리터럴로 남아 깨진다')
      .not.toContain('VIBE_PATH');
  });

  it('npm 쪽은 {{VIBE_PATH}} 를 유지한다 — postinstall 이 치환한다', () => {
    const s = JSON.stringify(npmHooks);
    expect(s).toContain('{{VIBE_PATH}}');
    expect(s).not.toContain('PLUGIN_ROOT');
  });

  it('같은 스크립트를 가리킨다 (경로 접두만 다르다)', () => {
    const strip = (o: unknown, token: string): string =>
      JSON.stringify(o).split(token).join('<ROOT>');
    expect(strip(pluginHooks, '${PLUGIN_ROOT}')).toBe(strip(npmHooks, '{{VIBE_PATH}}'));
  });
});

describe('npm 배포본이 플러그인 자산을 담는다', () => {
  it('files 에 .codex-plugin/ 이 있다', () => {
    expect(pkg.files as string[]).toContain('.codex-plugin/');
  });

  it('files 에 hooks/ 가 있어 plugin-hooks.json 도 함께 나간다', () => {
    expect(pkg.files as string[]).toContain('hooks/');
  });
});
