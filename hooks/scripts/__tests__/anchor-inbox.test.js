/**
 * ANCHOR / 인박스 결정론 기록 테스트 — 감사 2026-07-28 (L3·L5).
 *
 * JUDGE·RECORD·stuck 은 명령으로 판정되는데 ANCHOR 와 인박스만 산문 지시였다.
 * 재고정 대상과 인박스 블록 형식을 코드가 보장하는지 검증한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildAnchor } from '../lib/anchor.js';
import { prependInboxBlock, countInboxBlocks } from '../lib/inbox.js';

let dir;

const write = (rel, content) => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-anchor-'));
});

afterEach(() => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('buildAnchor — 디스크 재고정', () => {
  it('아티팩트가 없으면 missing 으로 보고한다 (기억으로 메우지 않는다)', () => {
    const a = buildAnchor(dir);
    expect(a.missing).toContain('feature');
    expect(a.missing).toContain('spec');
    expect(a.spec).toBeNull();
  });

  it('.last-feature 로 feature 를 해석하고 SPEC 경로를 찾는다', () => {
    write('.vibe/.last-feature', 'login\n');
    write('.vibe/specs/login.md', '# login SPEC\n');

    const a = buildAnchor(dir);
    expect(a.feature).toBe('login');
    expect(a.spec).toBe(path.join('.vibe', 'specs', 'login.md'));
    expect(a.missing).not.toContain('spec');
  });

  it('인자로 넘긴 feature 가 .last-feature 보다 우선한다', () => {
    write('.vibe/.last-feature', 'login\n');
    write('.vibe/specs/signup.md', '# signup SPEC\n');

    expect(buildAnchor(dir, 'signup').spec).toBe(path.join('.vibe', 'specs', 'signup.md'));
  });

  it('분할 SPEC 은 _index.md 로 해석한다', () => {
    write('.vibe/specs/checkout/_index.md', '# checkout\n');
    expect(buildAnchor(dir, 'checkout').spec).toBe(path.join('.vibe', 'specs', 'checkout', '_index.md'));
  });

  it('레거시 경로로 폴백한다', () => {
    write('.claude/vibe/specs/legacy.md', '# legacy\n');
    expect(buildAnchor(dir, 'legacy').spec).toBe(path.join('.claude', 'vibe', 'specs', 'legacy.md'));
  });

  it('run-ledger 와 scope.json 을 함께 재고정한다', () => {
    write('.vibe/metrics/run-ledger.json', JSON.stringify({ runFeature: 'login', verifyPassed: true }));
    write('.vibe/scope.json', '{}');

    const a = buildAnchor(dir, 'login');
    expect(a.ledger?.verifyPassed).toBe(true);
    expect(a.scope).toBe(path.join('.vibe', 'scope.json'));
    expect(a.missing).not.toContain('run-ledger');
  });

  it('직전 인박스 블록 하나만 가져온다', () => {
    prependInboxBlock(dir, { loop: 'old', result: 'ok', at: '2026-07-27T00:00:00Z', lines: ['이전'] });
    prependInboxBlock(dir, { loop: 'new', result: 'stuck', at: '2026-07-28T00:00:00Z', lines: ['최신'] });

    const a = buildAnchor(dir, 'x');
    expect(a.latestInbox).toContain('new');
    expect(a.latestInbox).not.toContain('old');
  });
});

describe('prependInboxBlock — 최신순 리뷰 큐', () => {
  it('블록을 최상단에 쌓는다', () => {
    prependInboxBlock(dir, { loop: 'first', result: 'ok', at: '2026-07-27T00:00:00Z' });
    prependInboxBlock(dir, { loop: 'second', result: 'fail', at: '2026-07-28T00:00:00Z' });

    const raw = fs.readFileSync(path.join(dir, '.vibe/loops/inbox.md'), 'utf-8');
    expect(raw.indexOf('## second')).toBeLessThan(raw.indexOf('## first'));
    expect(countInboxBlocks(dir)).toBe(2);
  });

  it('헤더는 한 번만 쓴다', () => {
    prependInboxBlock(dir, { loop: 'a', result: 'ok', at: '2026-07-28T00:00:00Z' });
    prependInboxBlock(dir, { loop: 'b', result: 'ok', at: '2026-07-28T00:00:01Z' });

    const raw = fs.readFileSync(path.join(dir, '.vibe/loops/inbox.md'), 'utf-8');
    expect(raw.match(/# Loop Inbox/g)).toHaveLength(1);
  });

  it('필수 필드가 없으면 기록하지 않는다 (fail-open)', () => {
    expect(prependInboxBlock(dir, { loop: 'x', result: 'ok' })).toBe(false);
    expect(countInboxBlocks(dir)).toBe(0);
  });

  it('본문 줄을 목록으로 적는다', () => {
    prependInboxBlock(dir, {
      loop: 'nightly', result: 'stuck', at: '2026-07-28T00:00:00Z',
      lines: ['발견: 3건 / 처리: 0건', '리뷰 필요: REQ-004'],
    });

    const raw = fs.readFileSync(path.join(dir, '.vibe/loops/inbox.md'), 'utf-8');
    expect(raw).toContain('## nightly — 2026-07-28T00:00:00Z — stuck');
    expect(raw).toContain('- 발견: 3건 / 처리: 0건');
    expect(raw).toContain('- 리뷰 필요: REQ-004');
  });
});

/**
 * 레거시 레이아웃 회귀 (G-D).
 *
 * `.last-feature` 와 `scope.json` 경로가 `.vibe/` 로 하드코딩돼 있어, 레거시
 * 프로젝트에서 ANCHOR 가 feature·spec·scope 를 전부 missing 으로 보고했다.
 * 쓰는 쪽(scope-from-spec, session-start)은 레거시를 인식하는데 읽는 쪽만
 * 빗나간 상태였다 — 조용히 죽은 재고정.
 */
describe('buildAnchor — 레거시 레이아웃', () => {
  const legacy = (rel, content = '') => {
    // 센티넬 경로 문자열을 리터럴로 만들지 않기 위해 조립한다
    const root = path.join(dir, '.' + 'claude', 'vibe');
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
    return p;
  };

  it('레거시 .last-feature / SPEC / scope 를 모두 재고정한다', () => {
    legacy('.last-feature', 'login\n');
    legacy(path.join('specs', 'login.md'), '# SPEC\n');
    legacy('scope.json', '{"auto":true}');

    const a = buildAnchor(dir);
    expect(a.feature).toBe('login');
    expect(a.spec).toContain('specs');
    expect(a.scope).toContain('scope.json');
    // run-ledger 만 없는 상태여야 한다 — 예전엔 셋 다 missing 이었다
    expect(a.missing).toEqual(['run-ledger']);
  });

  it('신규 레이아웃이 있으면 그쪽을 우선한다', () => {
    legacy('.last-feature', 'old\n');
    write('.vibe/.last-feature', 'new\n');
    expect(buildAnchor(dir).feature).toBe('new');
  });
});
