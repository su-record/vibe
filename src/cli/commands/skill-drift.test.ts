/**
 * 설치된 스킬이 배송본과 같은가.
 *
 * `vibe status` 는 스킬 **개수**만 셌다. 개수가 같아도 내용은 다를 수 있다 —
 * 중단된 postinstall, 부분 복사, 사용자가 고친 파일.
 *
 * ## 왜 해시 잠금 파일이 아니라 배송본 직접 대조인가 (실측 기록)
 *
 * 처음엔 `SKILLS.lock`(스킬별 파일 SHA-256)을 만들었다. 두 번 막혔다:
 *
 *  1. 설치 시 postinstall 이 `{{VIBE_PATH_URL}}`·`{{VIBE_PATH}}` 를 실제 경로로
 *     치환한다. 날것 비교는 치환된 스킬을 전부 드리프트로 잡았다 — 29개 중 11개 오탐.
 *  2. 역치환으로 되돌리려 했더니 **불가능**했다. 소스의 `file://{{VIBE_PATH}}` 와
 *     `{{VIBE_PATH_URL}}` 이 같은 문자열(`file:///…`)로 치환되므로 어느 쪽이었는지
 *     복원할 수 없다 (`process-steps.md` 가 여기 걸렸다).
 *
 * 방향을 뒤집으니 모호함이 사라졌다: 배송본에 **같은 치환을 적용해** 기대값을 만들고
 * 설치본과 비교한다. 그리고 배송본은 항상 곁에 있다 — CLI 가 그 안에서 돈다.
 * **그래서 잠금 파일이 필요 없다.**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { driftedSkills } from './info.js';

let root: string;
let shipped: string;
let installed: string;
const CORE = '/tmp/fake-vibe-core';

/** postinstall 과 같은 치환 */
const asInstalled = (text: string): string =>
  text
    .split('{{VIBE_PATH_URL}}').join('file:///' + CORE.replace(/^\//, ''))
    .split('{{VIBE_PATH}}').join(CORE);

const writeSkill = (base: string, name: string, files: Record<string, string>): void => {
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(base, name, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
};

const SOURCE = {
  'SKILL.md': '---\nname: demo\n---\n\nrun `{{VIBE_PATH}}/hooks/x.js`\n',
  'references/r.md': "import('file://{{VIBE_PATH}}/dist/tools/spec/index.js')\n",
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-drift-'));
  shipped = path.join(root, 'shipped');
  installed = path.join(root, 'installed');
  writeSkill(shipped, 'demo', SOURCE);
  writeSkill(installed, 'demo',
    Object.fromEntries(Object.entries(SOURCE).map(([k, v]) => [k, asInstalled(v)])));
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('driftedSkills', () => {
  it('치환만 다르면 드리프트가 아니다 — 오탐의 원인이었다', () => {
    expect(driftedSkills(installed, shipped, CORE)).toEqual([]);
  });

  /**
   * 이 케이스가 역치환을 포기하게 만든 것이다: `file://{{VIBE_PATH}}` 는
   * `{{VIBE_PATH_URL}}` 과 같은 결과로 치환돼 되돌릴 수 없다.
   */
  it('file://{{VIBE_PATH}} 형태도 오탐이 아니다', () => {
    expect(driftedSkills(installed, shipped, CORE)).not.toContain('demo');
  });

  it('내용이 바뀌면 잡는다', () => {
    fs.appendFileSync(path.join(installed, 'demo', 'SKILL.md'), 'tampered\n');
    expect(driftedSkills(installed, shipped, CORE)).toEqual(['demo']);
  });

  it('파일이 사라져도 잡는다 — 중단된 복사가 이 모양이다', () => {
    fs.rmSync(path.join(installed, 'demo', 'references', 'r.md'));
    expect(driftedSkills(installed, shipped, CORE)).toEqual(['demo']);
  });

  it('설치되지 않은 스킬은 드리프트가 아니다 — 조건부 스킬이 있다', () => {
    writeSkill(shipped, 'conditional', { 'SKILL.md': 'x' });
    expect(driftedSkills(installed, shipped, CORE)).toEqual([]);
  });

  /** 기준값이 없는 것과 어긋난 것은 다른 사건이다 — 전자를 후자로 보고하면 노이즈다 */
  it('배송본을 못 읽으면 판정하지 않는다', () => {
    expect(driftedSkills(installed, path.join(root, 'nope'), CORE)).toBeNull();
  });
});
