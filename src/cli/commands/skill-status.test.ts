/**
 * 상시 컨텍스트 비용 보고.
 *
 * 스킬은 하나하나가 매 세션 컨텍스트에 얹힌다. 그런데 늘어나는 경로가 셋인데
 * 어느 것도 보고되지 않았다:
 *
 *   1. vibe 자신
 *   2. `vibe init` 이 스택에 맞춰 **자동 설치**하는 외부 스킬
 *      (실측: `vercel-labs/agent-skills` 한 패키지가 스킬 9개)
 *   3. 개명 뒤 남은 vibe 잔재 — 소유 판정이 "현재 배송 목록 포함 여부" 라서
 *      개명된 스킬은 영원히 "vibe 것이 아님" 으로 분류돼 지워지지도 보고되지도
 *      않았다 (실측: 개발 머신에 clone·figma·test 3개가 남아 있었다)
 *
 * 잔재는 **보고만** 한다. `docs`·`test` 같은 일반적인 이름이 섞여 있어 사용자가
 * 만든 동명 스킬을 지울 위험이 실재하고, 애매할 때 지우는 쪽이 훨씬 나쁘다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { formatSkillStatus } from './info.js';

let root: string;
let installed: string;
let shipped: string;

const mk = (base: string, ...names: string[]): void => {
  for (const n of names) {
    fs.mkdirSync(path.join(base, n), { recursive: true });
    fs.writeFileSync(path.join(base, n, 'SKILL.md'), `---\nname: ${n}\n---\n`);
  }
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-skill-status-'));
  installed = path.join(root, 'installed');
  shipped = path.join(root, 'shipped');
  fs.mkdirSync(installed, { recursive: true });
  fs.mkdirSync(shipped, { recursive: true });
});
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('formatSkillStatus', () => {
  it('설치본이 없으면 미설치로 보고한다', () => {
    expect(formatSkillStatus(path.join(root, 'nope'), shipped)).toContain('not installed');
  });

  /** 진입 스킬은 `vibe.` 접두사가 없는 `vibe` 다 — 접두사로 세면 외부로 오분류된다 */
  it('소유 판정을 접두사가 아니라 배송 목록으로 한다', () => {
    mk(shipped, 'vibe', 'vibe.run');
    mk(installed, 'vibe', 'vibe.run');
    const out = formatSkillStatus(installed, shipped);
    expect(out).toContain('vibe 2');
    expect(out, '배송 목록에 있으면 external 이 아니다').not.toContain('external');
  });

  it('외부 스킬을 이름과 함께 보고한다 — 몇 개 늘었는지 보이게', () => {
    mk(shipped, 'vibe');
    mk(installed, 'vibe', 'agent-reach', 'deploy-to-vercel');
    const out = formatSkillStatus(installed, shipped);
    expect(out).toContain('external          2');
    expect(out).toContain('agent-reach');
    expect(out).toContain('deploy-to-vercel');
  });

  it('개명 잔재를 외부 스킬과 구분해 보고한다', () => {
    mk(shipped, 'vibe.clone');
    mk(installed, 'vibe.clone', 'clone', 'agent-reach');
    const out = formatSkillStatus(installed, shipped);
    expect(out).toContain('stale');
    expect(out, '잔재는 external 집계에서 빠진다').toContain('external          1');
  });

  it('잔재가 없으면 그 줄을 내지 않는다 — 조용할 때는 조용해야 한다', () => {
    mk(shipped, 'vibe');
    mk(installed, 'vibe');
    expect(formatSkillStatus(installed, shipped)).not.toContain('stale');
  });

  /** 보고지 삭제가 아니다 — 애매할 때 지우는 쪽이 훨씬 나쁘다 */
  it('아무것도 지우지 않는다', () => {
    mk(shipped, 'vibe');
    mk(installed, 'vibe', 'clone', 'test', 'agent-reach');
    formatSkillStatus(installed, shipped);
    expect(fs.readdirSync(installed).sort()).toEqual(['agent-reach', 'clone', 'test', 'vibe']);
  });
});
