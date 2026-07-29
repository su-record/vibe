/**
 * init 워크플로 계약 (REQ-audit-p2-remediation-010)
 *
 * 배경: 311 L 의 초기화 워크플로가 파일 쓰기·설정 생성·레거시 통합을 수행하는데
 * 직접 테스트가 없었다. 이 경로가 깨지면 사용자의 첫 경험이 깨지고, 더 나쁘게는
 * 기존 프로젝트 설정을 덮어쓸 수 있다.
 *
 * 실제 파일시스템에 쓰되 임시 디렉터리에 가둔다. HOME 도 임시로 돌려, 초기화가
 * 사용자 홈이나 전역 경로를 건드리지 않는다는 것을 관측 가능하게 만든다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { init } from './init.js';

let projectDir: string;
let fakeHome: string;
let originalCwd: string;
let originalHome: string | undefined;
let originalCI: string | undefined;

/** 디렉터리 아래 모든 상대 경로를 모은다 */
function tree(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      out.push(path.relative(dir, full));
      if (e.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return out.sort();
}

beforeEach(() => {
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalCI = process.env.CI;
  // init 은 CI 에서 capability/devlog 프롬프트를 건너뛴다 — 기존 비대화형 게이트를 그대로 쓴다
  process.env.CI = '1';
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-init-'));
  fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-home-'));
  process.env.HOME = fakeHome;
  process.chdir(projectDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalCI === undefined) delete process.env.CI;
  else process.env.CI = originalCI;
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

describe('init — 산출물', () => {
  it('.vibe SSOT 와 표준 하위 디렉터리를 만든다', async () => {
    await init();

    expect(fs.existsSync(path.join(projectDir, '.vibe'))).toBe(true);
    for (const sub of ['specs', 'features', 'plans', 'todos', 'memories', 'metrics', 'recipes', 'anti-patterns']) {
      expect(fs.existsSync(path.join(projectDir, '.vibe', sub)), `.vibe/${sub} 없음`).toBe(true);
    }
  });

  it('config.json 과 constitution.md 를 만든다', async () => {
    await init();

    const configPath = path.join(projectDir, '.vibe', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    expect(() => JSON.parse(fs.readFileSync(configPath, 'utf-8'))).not.toThrow();
    expect(fs.existsSync(path.join(projectDir, '.vibe', 'constitution.md'))).toBe(true);
  });

  it('하네스별로 다른 CLI 설정 디렉터리를 고른다', async () => {
    await init(undefined, 'codex');
    expect(fs.existsSync(path.join(projectDir, '.codex'))).toBe(true);
  });
});

describe('init — 격리', () => {
  // init 은 의도적으로 홈에 전역 규약을 주입한다 (init.ts:460 — ~/.claude/CLAUDE.md,
  // ~/.codex/AGENTS.md, ~/.gemini/GEMINI.md + cursor 에셋). 따라서 "홈에 쓰지 않는다" 가
  // 아니라 "문서화된 하네스 디렉터리 밖으로는 새지 않는다" 가 지킬 계약이다.
  const ALLOWED_HOME_ROOTS = ['.claude', '.codex', '.gemini', '.cursor', '.vibe'];

  function strayHomeWrites(): string[] {
    return tree(fakeHome)
      .map((rel) => rel.split(path.sep)[0])
      .filter((root, i, arr) => arr.indexOf(root) === i)
      .filter((root) => !ALLOWED_HOME_ROOTS.includes(root));
  }

  it('홈에는 문서화된 하네스 디렉터리에만 쓴다', async () => {
    await init();
    expect(strayHomeWrites()).toEqual([]);
  });

  it('전역 규약 파일을 주입한다', async () => {
    await init();
    expect(fs.existsSync(path.join(fakeHome, '.claude', 'CLAUDE.md'))).toBe(true);
  });

  it('프로젝트 이름을 주면 프로젝트 산출물은 그 하위에만 만든다', async () => {
    await init('myapp');

    expect(fs.existsSync(path.join(projectDir, 'myapp', '.vibe'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, '.vibe'))).toBe(false);
    expect(strayHomeWrites()).toEqual([]);
  });

  it('이미 있는 폴더 이름이면 만들지 않고 멈춘다', async () => {
    fs.mkdirSync(path.join(projectDir, 'taken'));
    fs.writeFileSync(path.join(projectDir, 'taken', 'keep.txt'), 'mine');

    await init('taken');

    // 덮어쓰기는 사용자 데이터 손실이다 — 반드시 거절해야 한다
    expect(fs.readFileSync(path.join(projectDir, 'taken', 'keep.txt'), 'utf-8')).toBe('mine');
    expect(fs.existsSync(path.join(projectDir, 'taken', '.vibe'))).toBe(false);
  });
});

describe('init — 멱등성', () => {
  it('재실행해도 실패하지 않는다', async () => {
    await init();
    await expect(init()).resolves.not.toThrow();
  });

  it('재실행이 사용자가 고친 config 를 파괴하지 않는다', async () => {
    await init();
    const configPath = path.join(projectDir, '.vibe', 'config.json');
    const edited = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    edited.qualityCheck = { consoleAllow: ['src/mine.ts'] };
    fs.writeFileSync(configPath, JSON.stringify(edited, null, 2));

    await init();

    const after = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(after.qualityCheck).toEqual({ consoleAllow: ['src/mine.ts'] });
  });

  it('재실행이 사용자가 만든 SPEC 을 지우지 않는다', async () => {
    await init();
    const spec = path.join(projectDir, '.vibe', 'specs', 'mine.md');
    fs.writeFileSync(spec, '# my spec');

    await init();

    expect(fs.existsSync(spec)).toBe(true);
    expect(fs.readFileSync(spec, 'utf-8')).toBe('# my spec');
  });
});
