/**
 * 플러그인 패키징 계약.
 *
 * vibe 는 세 경로로 배포된다 — npm 전역 설치, Codex 플러그인, Claude Code 플러그인.
 * 훅 정의가 **세 벌**인 것이 이 계약의 핵심 위험이다:
 *
 *   hooks/hooks.json                npm 경로 — postinstall 이 `{{VIBE_PATH}}` 를 치환
 *   hooks/plugin-hooks.json         Codex — `${PLUGIN_ROOT}` (생성물)
 *   hooks/claude-plugin-hooks.json  Claude Code — `${CLAUDE_PLUGIN_ROOT}` (생성물)
 *
 * 갈라지면 한쪽 하네스에서만 가드가 죽고, 그건 조용히 일어난다. 이벤트 집합과 경로
 * 표기를 여기서 고정한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(read(rel)) as Record<string, unknown>;

const codexManifest = readJson('.codex-plugin/plugin.json');
const claudeManifest = readJson('.claude-plugin/plugin.json');
const pkg = readJson('package.json');

describe.each([
  ['.codex-plugin/plugin.json', codexManifest],
  ['.claude-plugin/plugin.json', claudeManifest],
])('%s — 필수 필드', (_file, manifest) => {
  it.each(['name', 'version', 'description'])('%s 가 있다', (field) => {
    expect(typeof manifest[field]).toBe('string');
    expect((manifest[field] as string).length).toBeGreaterThan(0);
  });

  it('name 은 kebab-case 다', () => {
    expect(manifest.name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('version 이 package.json 과 같다 — 배포 세 경로가 어긋나면 안 된다', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('hooks 경로가 ./ 로 시작하고 루트를 벗어나지 않는다', () => {
    const rel = manifest.hooks as string;
    expect(rel).toMatch(/^\.\//);
    expect(rel).not.toContain('..');
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });
});

/**
 * Claude Code 는 기본으로 `hooks/hooks.json` 을 읽는다 — 그건 npm 전용이라
 * `{{VIBE_PATH}}` 가 리터럴로 남아 전부 깨진다. 반드시 덮어써야 한다.
 */
it('Claude Code 매니페스트는 기본 훅 경로를 덮어쓴다', () => {
  expect(claudeManifest.hooks).toBe('./hooks/claude-plugin-hooks.json');
});

describe('훅 정의 세 벌이 갈라지지 않는다', () => {
  const npmHooks = readJson('hooks/hooks.json').hooks as Record<string, unknown>;
  const variants = {
    codex: { hooks: readJson('hooks/plugin-hooks.json').hooks as Record<string, unknown>, token: '${PLUGIN_ROOT}' },
    claude: { hooks: readJson('hooks/claude-plugin-hooks.json').hooks as Record<string, unknown>, token: '${CLAUDE_PLUGIN_ROOT}' },
  };

  it.each(Object.entries(variants))('%s — 이벤트 집합이 npm 쪽과 같다', (_name, { hooks }) => {
    expect(Object.keys(hooks).sort()).toEqual(Object.keys(npmHooks).sort());
  });

  it.each(Object.entries(variants))('%s — 자기 토큰만 쓰고 다른 토큰은 남지 않는다', (_name, { hooks, token }) => {
    const s = JSON.stringify(hooks);
    expect(s).toContain(token);
    expect(s, '{{VIBE_PATH}} 는 postinstall 전용 — 플러그인에서는 리터럴로 남아 깨진다')
      .not.toContain('VIBE_PATH');
  });

  it('npm 쪽은 {{VIBE_PATH}} 를 유지한다 — postinstall 이 치환한다', () => {
    const s = JSON.stringify(npmHooks);
    expect(s).toContain('{{VIBE_PATH}}');
    expect(s).not.toContain('PLUGIN_ROOT');
  });

  /**
   * 플러그인 커맨드는 `plugin-hook-entry.js` 를 한 겹 거친다 — npm 설치본과 동시에
   * 설치되면 같은 이벤트가 두 벌 등록돼 게이트가 2회, Stop auto-commit 도 2회 돈다.
   * 감싸되 **가리키는 스크립트와 인자는 같아야** 한다.
   */
  it.each(Object.entries(variants))('%s — 진입점으로 감싸되 대상 스크립트는 동일하다', (_name, { hooks, token }) => {
    const unwrap = (s: string): string =>
      s.split(`${token}/hooks/scripts/plugin-hook-entry.js `).join('{{VIBE_PATH}}/hooks/scripts/');
    expect(unwrap(JSON.stringify(hooks))).toBe(JSON.stringify(npmHooks));
  });

  it('진입점 스크립트가 실재한다', () => {
    expect(fs.existsSync(path.join(ROOT, 'hooks', 'scripts', 'plugin-hook-entry.js'))).toBe(true);
  });
});

describe('npm 배포본이 플러그인 자산을 담는다', () => {
  const files = pkg.files as string[];

  it.each(['.codex-plugin/', '.claude-plugin/', 'hooks/'])('files 에 %s 가 있다', (entry) => {
    expect(files).toContain(entry);
  });

  /** 마켓플레이스는 플러그인 **바깥**의 개념이다 — 트리 안에 들어가면 validate 가 혼동한다 */
  it('마켓플레이스 매니페스트는 배포 트리에서 제외한다', () => {
    expect(files).toContain('!.claude-plugin/marketplace.json');
  });
});

/**
 * 배포 트리를 커밋하는 이유: Claude Code 마켓플레이스는 저장소를 **클론**해서 읽는데
 * `dist/` 는 gitignore 대상이라 클론에 없고, `agents/*.md` 는 frontmatter 가
 * postinstall 에서 생성되므로 클론에는 맨몸이다. 즉 저장소를 그대로 가리키면
 * 기능이 빠진 플러그인이 된다(실측: 에이전트 11개 중 7개만, description 없이 로드).
 */
describe('.claude-plugin/marketplace.json', () => {
  const mp = readJson('.claude-plugin/marketplace.json');
  const entry = (mp.plugins as Array<Record<string, unknown>>)[0];

  it.each(['name', 'description', 'owner', 'plugins'])('최상위 %s 가 있다', (k) => {
    expect(mp[k]).toBeDefined();
  });

  it('owner 는 객체다 — 문자열이면 claude plugin validate 가 거부한다', () => {
    expect(typeof mp.owner).toBe('object');
  });

  it('플러그인 이름이 매니페스트와 같다', () => {
    expect(entry.name).toBe(claudeManifest.name);
  });

  /**
   * 고정하는 것은 **경로 값이 아니라 성질**이다 — 빌드 산출물을 가리킬 것, 저장소
   * 루트를 가리키지 말 것. 값을 박으면 트리 위치를 옮기려는 유지보수자에게
   * 테스트가 "되돌려라" 를 요구한다. 기준값은 빌드 스크립트에서 읽는다.
   */
  it('source 가 빌드 스크립트의 산출 위치와 일치한다', () => {
    const outDir = /const OUT = path\.join\(ROOT, '([^']+)', '([^']+)'\)/
      .exec(read('scripts/build-plugin.ts'));
    expect(outDir, 'build-plugin.ts 의 OUT 을 읽지 못했다').not.toBeNull();
    expect(entry.source).toBe(`./${outDir![1]}/${outDir![2]}`);
  });

  it('source 가 저장소 루트가 아니다 — 루트면 워킹트리가 통째로 복사된다', () => {
    expect(entry.source).not.toBe('./');
    expect(entry.source as string).toMatch(/^\.\/.+/);
  });

  it('빌드 산출물이 커밋된다 — 클론에 없으면 플러그인이 반쪽이 된다', () => {
    expect(read('.gitignore')).not.toMatch(/^\/plugins\/$/m);
  });

  /**
   * `.gitignore` 의 `dist/` 는 경로 어디에서나 걸리므로 `plugins/vibe/dist/` 까지
   * 삼킨다. 그러면 트리는 커밋되는데 **정작 dist 만 빠진 채** 커밋된다 — 커밋
   * 방식을 택한 이유가 통째로 무효가 되고, 그게 조용히 일어난다.
   */
  it('배포 트리의 dist 는 gitignore 예외로 살아 있다', () => {
    expect(read('.gitignore')).toMatch(/^!\/plugins\/vibe\/dist\/$/m);
  });

  it('배포 트리에 dist 가 실제로 조립돼 있다', () => {
    expect(fs.existsSync(path.join(ROOT, 'plugins', 'vibe', 'dist', 'cli', 'index.js'))).toBe(true);
  });

  /** 에이전트는 평면 + frontmatter 가 구워진 상태여야 한다 — 하위 디렉토리는 스캔되지 않는다 */
  it('배포 트리의 에이전트가 평면이고 frontmatter 가 구워져 있다', () => {
    const dir = path.join(ROOT, 'plugins', 'vibe', 'agents');
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    expect(entries.every((e) => e.isFile() && e.name.endsWith('.md'))).toBe(true);
    expect(entries.length).toBeGreaterThanOrEqual(11);
    for (const e of entries) {
      const head = fs.readFileSync(path.join(dir, e.name), 'utf-8').slice(0, 400);
      expect(head, `${e.name}: frontmatter 없음`).toMatch(/^---\nname: /);
      expect(head, `${e.name}: description 이 따옴표 없이 나가면 YAML 이 깨진다`)
        .toMatch(/\ndescription: "/);
    }
  });
});

describe('.agents/plugins/marketplace.json (Codex)', () => {
  const entry = (readJson('.agents/plugins/marketplace.json').plugins as
    Array<Record<string, unknown>>)[0];

  it('같은 배포 트리를 가리킨다 — 하네스마다 다른 트리를 두지 않는다', () => {
    const claude = (readJson('.claude-plugin/marketplace.json').plugins as
      Array<Record<string, unknown>>)[0].source;
    expect((entry.source as Record<string, string>).path).toBe(claude);
  });
});
