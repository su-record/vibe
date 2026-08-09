/**
 * 사람 판단 게이트 테스트.
 *
 * 이 모듈의 존재 이유는 두 가지다 — 게이트가 **구체적 질문**을 담는 것,
 * 그리고 **세션이 죽어도 살아남는** 것. 둘 다 여기서 고정한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openGate, listOpenGates, answerGate, formatOpenGates, gatesDir } from '../lib/gates.js';

let dir;
const AT = '2026-08-09T00:00:00Z';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-gates-'));
});

afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

const open = (over = {}) => openGate(dir, {
  id: 'spec-login',
  question: 'SPEC login 을 승인하시겠습니까? 세션 만료 24h 가정 확인 필요',
  options: ['승인', '수정 후 재작성', '중단'],
  kind: 'spec-approval',
  at: AT,
  ...over,
});

describe('openGate — 구체적 질문만 게이트가 된다', () => {
  it('질문과 선택지를 담아 연다', () => {
    expect(open()).toBeTruthy();

    const [g] = listOpenGates(dir);
    expect(g.question).toContain('승인하시겠습니까');
    expect(g.options).toHaveLength(3);
    expect(g.kind).toBe('spec-approval');
    expect(g.status).toBe('open');
  });

  it('질문이 없으면 게이트가 아니다', () => {
    expect(openGate(dir, { id: 'x', at: AT })).toBeNull();
    expect(listOpenGates(dir)).toEqual([]);
  });

  it('"대기" 같은 너무 짧은 문구는 거른다 — 모호한 상태는 게이트가 아니다', () => {
    expect(open({ question: '대기' })).toBeNull();
    expect(listOpenGates(dir)).toEqual([]);
  });

  it('선택지는 없어도 된다 (자유 서술 질문)', () => {
    open({ id: 'free', options: undefined });
    expect(listOpenGates(dir)[0].options).toEqual([]);
  });

  it.each(['../../escape', 'a/b/c', '..', '/etc/passwd'])('id %s 로 게이트 디렉토리를 벗어나지 못한다', (id) => {
    const file = open({ id });
    // 검사할 속성은 "파일명에 .. 이 없다" 가 아니라 **경로가 디렉토리 안에 머문다** 이다
    const root = path.resolve(gatesDir(dir));
    expect(path.resolve(file).startsWith(root + path.sep)).toBe(true);
  });
});

describe('세션이 죽어도 살아남는다', () => {
  it('다른 호출에서 그대로 읽힌다 (디스크가 유일한 상태)', () => {
    open();
    // 같은 프로세스지만 메모리를 공유하지 않는 경로 — 파일에서만 읽는다
    const gates = listOpenGates(dir);
    expect(gates).toHaveLength(1);
    expect(gates[0].id).toBe('spec-login');
  });

  it('여러 게이트가 서로를 덮어쓰지 않는다', () => {
    open({ id: 'a', at: '2026-08-09T00:00:01Z' });
    open({ id: 'b', at: '2026-08-09T00:00:02Z' });
    open({ id: 'c', at: '2026-08-09T00:00:03Z' });
    expect(listOpenGates(dir).map(g => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('오래된 것부터 정렬한다', () => {
    open({ id: 'late', at: '2026-08-09T09:00:00Z' });
    open({ id: 'early', at: '2026-08-09T01:00:00Z' });
    expect(listOpenGates(dir).map(g => g.id)).toEqual(['early', 'late']);
  });

  it('손상된 파일은 무시하고 나머지를 돌려준다 (fail-open)', () => {
    open({ id: 'good' });
    fs.writeFileSync(path.join(gatesDir(dir), 'broken.json'), '{ not json', 'utf-8');
    expect(listOpenGates(dir).map(g => g.id)).toEqual(['good']);
  });

  it('디렉토리가 없으면 빈 목록', () => {
    expect(listOpenGates(dir)).toEqual([]);
  });
});

describe('answerGate — 답은 지우지 않고 남긴다', () => {
  it('답하면 열린 목록에서 빠진다', () => {
    open();
    expect(answerGate(dir, 'spec-login', '승인', AT)).toBe(true);
    expect(listOpenGates(dir)).toEqual([]);
  });

  it('무엇을 묻고 무엇으로 답했는지가 파일에 남는다 (증거)', () => {
    open();
    answerGate(dir, 'spec-login', '수정 후 재작성', '2026-08-09T01:00:00Z');

    const saved = JSON.parse(fs.readFileSync(path.join(gatesDir(dir), 'spec-login.json'), 'utf-8'));
    expect(saved.status).toBe('answered');
    expect(saved.answer).toBe('수정 후 재작성');
    expect(saved.answeredAt).toBe('2026-08-09T01:00:00Z');
    expect(saved.question).toContain('승인하시겠습니까'); // 질문도 보존
  });

  it('없는 게이트에는 답할 수 없다', () => {
    expect(answerGate(dir, 'nope', '승인', AT)).toBe(false);
  });

  it('이미 답한 게이트에 두 번 답하지 않는다', () => {
    open();
    answerGate(dir, 'spec-login', '승인', AT);
    expect(answerGate(dir, 'spec-login', '중단', AT)).toBe(false);
  });
});

describe('formatOpenGates', () => {
  it('선택지를 번호로 보여준다', () => {
    open();
    const out = formatOpenGates(listOpenGates(dir));
    expect(out).toContain('[1] 승인');
    expect(out).toContain('[3] 중단');
    expect(out).toContain('spec-approval');
  });

  it('없으면 없다고 말한다', () => {
    expect(formatOpenGates([])).toBe('열린 게이트 없음');
  });
});
