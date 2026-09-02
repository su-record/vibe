/**
 * 일회성 코드 레인 (SPEC: .vibe/specs/ephemeral-code-lane.md — DC-1 ~ DC-8).
 *
 * 이 레인은 원래 "열지 말자" 로 판단했던 것이고, 사유 중 하나가 게이트 회피 구멍이었다.
 * 그래서 이 파일의 대부분은 **면제를 훔치려는 경로를 막는 테스트**다. 정책 단언이므로
 * 값을 박는다 — 뒤집으려면 의도적으로 지워야 한다.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  EPHEMERAL_DIR,
  isEphemeralPath,
  ephemeralPathsInGitCommand,
  formatEphemeralBlock,
} from '../lib/ephemeral-lane.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');

describe('DC-1 — 경로만으로 판정한다', () => {
  it.each([
    '.vibe/ephemeral/probe.js',
    './.vibe/ephemeral/probe.js',
    '.vibe/ephemeral/nested/deep/probe.ts',
    '.vibe/ephemeral',
  ])('%s 는 일회성이다', (p) => {
    expect(isEphemeralPath(p)).toBe(true);
  });

  it.each([
    'src/index.ts',
    '.vibe/specs/x.md',
    '.vibe/ephemeralish/probe.js',
    'ephemeral/probe.js',
    '',
  ])('%s 는 일회성이 아니다', (p) => {
    expect(isEphemeralPath(p)).toBe(false);
  });

  it('프로젝트 루트를 주면 절대 경로도 인식한다', () => {
    expect(isEphemeralPath('/home/u/proj/.vibe/ephemeral/x.js', '/home/u/proj')).toBe(true);
  });

  it('윈도우 구분자를 견딘다', () => {
    expect(isEphemeralPath('.vibe\\ephemeral\\x.js')).toBe(true);
  });
});

describe('DC-2 — 면제를 훔칠 수 없다 (정책 단언)', () => {
  // 이 레인의 존재 이유가 걸린 테스트다. 하나라도 true 가 되면 품질 게이트에 구멍이 난다.
  it.each([
    ['.vibe/ephemeral/../src/index.ts', '상위 탈출로 소스에 닿는다'],
    ['.vibe/ephemeral/../../src/index.ts', '프로젝트 밖으로 나간다'],
    ['.vibe/ephemeral/../../../etc/passwd', '루트로 나간다'],
    ['.vibe/ephemeral/./../package.json', '점 하나를 끼워도 마찬가지'],
  ])('%s 는 일회성이 아니다 — %s', (p) => {
    expect(isEphemeralPath(p)).toBe(false);
  });

  it('다른 프로젝트의 절대 경로는 일회성이 아니다 — 면제는 이 저장소 안에서만 의미가 있다', () => {
    expect(isEphemeralPath('/other/proj/.vibe/ephemeral/x.js', '/home/u/proj')).toBe(false);
  });

  it('프로젝트 루트 밖의 절대 경로는 루트를 안 줘도 거짓이다', () => {
    expect(isEphemeralPath('/var/tmp/.vibe/ephemeral/x.js')).toBe(false);
  });

  it('판정 실패는 fail-safe — 모르면 면제하지 않는다', () => {
    expect(isEphemeralPath(null)).toBe(false);
    expect(isEphemeralPath(undefined)).toBe(false);
    expect(isEphemeralPath({})).toBe(false);
  });
});

describe('DC-4 · DC-5 — git 명령에서 경로를 뽑는다', () => {
  it('git add -f 로 명시한 일회성 경로를 잡는다', () => {
    expect(ephemeralPathsInGitCommand('git add -f .vibe/ephemeral/probe.js'))
      .toEqual(['.vibe/ephemeral/probe.js']);
  });

  it('git commit · git stage 도 본다', () => {
    expect(ephemeralPathsInGitCommand('git commit .vibe/ephemeral/a.js -m "x"')).toHaveLength(1);
    expect(ephemeralPathsInGitCommand('git stage .vibe/ephemeral/b.js')).toHaveLength(1);
  });

  it('따옴표를 벗긴다', () => {
    expect(ephemeralPathsInGitCommand('git add "./.vibe/ephemeral/probe.js"')).toHaveLength(1);
  });

  it('여러 경로를 모두 잡는다', () => {
    expect(ephemeralPathsInGitCommand('git add .vibe/ephemeral/a.js .vibe/ephemeral/b.js'))
      .toHaveLength(2);
  });

  // 일상 명령을 막으면 게이트가 꺼진다 — gitignore 가 이미 거른다
  it.each(['git add .', 'git add -A', 'git add -u', 'git commit -am "msg"', 'git status'])(
    '%s 는 걸리지 않는다',
    (cmd) => {
      expect(ephemeralPathsInGitCommand(cmd)).toEqual([]);
    },
  );

  it('git 이 아닌 명령의 인자는 보지 않는다', () => {
    expect(ephemeralPathsInGitCommand('node .vibe/ephemeral/probe.js')).toEqual([]);
  });

  it('세미콜론 뒤 다른 명령의 인자를 끌어오지 않는다', () => {
    expect(ephemeralPathsInGitCommand('git status; node .vibe/ephemeral/probe.js')).toEqual([]);
  });

  it('플래그를 경로로 착각하지 않는다', () => {
    expect(ephemeralPathsInGitCommand('git add --force .vibe/ephemeral/a.js')).toEqual(['.vibe/ephemeral/a.js']);
  });
});

describe('차단 메시지', () => {
  it('무엇을·왜·대안을 함께 낸다 — 이유 없는 차단은 우회된다', () => {
    const text = formatEphemeralBlock(['.vibe/ephemeral/probe.js']);
    expect(text).toContain('.vibe/ephemeral/probe.js');
    expect(text).toContain('커밋되지 않는다');
    expect(text).toContain('밖으로 옮기고');
  });
});

describe('DC-3 — 품질 검사가 일회성 경로를 건너뛴다', () => {
  // 실제 PROJECT_DIR 아래에서 검사해야 한다 — 임시 디렉토리는 **프로젝트 밖이라 설계상
  // 면제되지 않는다**(DC-2). 이 경로는 gitignore 대상이라 저장소를 오염시키지 않는다.
  const LANE = path.join(ROOT, EPHEMERAL_DIR);
  // 대조군은 레인의 **형제** 경로다 — `.vibe/ephemeral-control.ts` 는 `.vibe/ephemeral/` 접두사에
  // 걸리지 않아야 하므로 면제 판정이 정확한 접두사 비교인지까지 함께 검증한다.
  // `src/` 에 두면 안 된다: wiring-integrity 가 `src/**/*.ts` 를 glob 한 뒤 읽는 사이에
  // 이 파일이 지워져 ENOENT 로 터진다 (실측: PR #102 CI, 병렬 테스트 파일 간 경쟁).
  // `hooks/scripts/**`·`__tests__/**` 도 안 된다: console.log 허용 경로라 대조가 성립하지 않는다.
  const CONTROL = path.join(ROOT, '.vibe', 'ephemeral-control.ts');
  const DIRTY = 'export function probe(): void { console.log("x"); }\n';
  let created;

  beforeEach(() => {
    created = fs.existsSync(LANE) ? null : LANE;
    fs.mkdirSync(LANE, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(path.join(LANE, 'probe.ts'), { force: true });
    fs.rmSync(CONTROL, { force: true });
    if (created) fs.rmSync(created, { recursive: true, force: true });
  });

  it('일회성 경로는 findings 없이 통과한다', async () => {
    const { run } = await import('../code-check.js');
    const file = path.join(LANE, 'probe.ts');
    fs.writeFileSync(file, DIRTY);
    const result = await run({ filePath: file });
    expect(result.exitCode).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('같은 내용이 일회성 밖이면 걸린다 — 면제는 경로 안에서만이다', async () => {
    const { run } = await import('../code-check.js');
    fs.writeFileSync(CONTROL, DIRTY);
    const result = await run({ filePath: CONTROL });
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('프로젝트 밖의 같은 모양 경로는 면제되지 않는다', async () => {
    const { run } = await import('../code-check.js');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-ephemeral-'));
    try {
      fs.mkdirSync(path.join(outside, EPHEMERAL_DIR), { recursive: true });
      const file = path.join(outside, EPHEMERAL_DIR, 'probe.ts');
      fs.writeFileSync(file, DIRTY);
      const result = await run({ filePath: file });
      expect(result.findings.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('DC-6 — pre-tool-guard 가 차단한다', () => {
  it('git add -f 일회성 경로는 exit 2', async () => {
    const { run } = await import('../pre-tool-guard.js');
    const code = await run({
      toolName: 'Bash',
      toolInput: JSON.stringify({ command: 'git add -f .vibe/ephemeral/probe.js' }),
      payload: { tool_input: { command: 'git add -f .vibe/ephemeral/probe.js' } },
    });
    expect(code).toBe(2);
  });

  it('평범한 git add 는 통과한다', async () => {
    const { run } = await import('../pre-tool-guard.js');
    const code = await run({
      toolName: 'Bash',
      toolInput: JSON.stringify({ command: 'git add src/index.ts' }),
      payload: { tool_input: { command: 'git add src/index.ts' } },
    });
    expect(code).toBe(0);
  });
});

describe('DC-7 · DC-8 — 1차 방어와 문서', () => {
  it('gitignore 에 일회성 경로가 있다 — 이것이 1차 방어다', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8');
    expect(ignore).toMatch(/^\.vibe\/ephemeral\/$/m);
  });

  it('CLAUDE.md 가 판정 주체와 방어 순서를 정확히 적는다', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8');
    expect(doc).toMatch(/판정은 모델이 아니라 경로가 한다/);
    expect(doc).toMatch(/1차/);
    expect(doc).toMatch(/심층 방어/);
    expect(doc).toMatch(/상위 탈출로 면제를 훔칠 수 없다/);
  });
});
