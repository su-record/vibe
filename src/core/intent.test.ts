import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VibeError } from './errors.js';
import { abandon, approve, draft, loadScenarios } from './intent.js';
import { readState } from './state.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe4-intent-'));
  fs.mkdirSync(path.join(root, '.vibe'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const INTENT = '# 주문 엑셀 → 정산표\n\n## 왜\n매주 손으로 한다\n';
const OK = `- { id: s1, then: 정산표가 나온다, check: { type: file, path: out.xlsx, exists: true } }\n`;

describe('intent draft / approve', () => {
  it('검사 없는 시나리오가 하나라도 있으면 아무것도 저장하지 않는다', () => {
    const result = draft(root, INTENT, `${OK}- { id: s2, then: 문구가 좋다 }\n`);
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(root, '.vibe', 'scenarios.yaml'))).toBe(false);
    expect(readState(root).state).toBe('NONE');
  });

  it('저장되면 DRAFT 가 되고 승인 토큰이 나온다', () => {
    const result = draft(root, INTENT, OK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(readState(root)).toMatchObject({ state: 'DRAFT', intentHash: result.hash });
    expect(loadScenarios(root).map((s) => s.id)).toEqual(['s1']);
    expect(result.token).toMatch(/^\d{3} \d{3}$/);
  });

  it('토큰 없이는 APPROVED 가 되지 않는다 — 틀린 번호는 종료 3', () => {
    draft(root, INTENT, OK);
    expect(() => approve(root, '000 000')).toThrowError(VibeError);
    try {
      approve(root, '123456');
    } catch (error) {
      expect((error as VibeError).exitCode).toBe(3);
    }
    expect(readState(root).state).toBe('DRAFT');
  });

  it('맞는 토큰이면 APPROVED, 같은 토큰은 두 번 안 된다', () => {
    const result = draft(root, INTENT, OK);
    if (!result.ok) throw new Error('draft failed');
    expect(approve(root, result.token)).toEqual({ hash: result.hash });
    expect(readState(root).state).toBe('APPROVED');
    expect(() => approve(root, result.token)).toThrowError(VibeError);
  });

  it('Intent 가 바뀌면 이전 토큰은 무효다', () => {
    const first = draft(root, INTENT, OK);
    if (!first.ok) throw new Error('draft failed');
    fs.writeFileSync(path.join(root, '.vibe', 'scenarios.yaml'), `${OK}- { id: s2, then: 하나 더, check: { type: run, cmd: "exit 0" } }\n`);
    expect(() => approve(root, first.token)).toThrowError(/바뀌었다/);
  });

  it('abandon 은 사유가 필수이고 장부에 남는다', () => {
    draft(root, INTENT, OK);
    expect(() => abandon(root, '')).toThrowError(VibeError);
    abandon(root, '고객이 범위를 바꿨다');
    expect(readState(root)).toMatchObject({ state: 'ABANDONED', abandonedReason: '고객이 범위를 바꿨다' });
  });
});
