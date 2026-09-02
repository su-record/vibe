/**
 * 프리픽스 캐시 표면 게이트 테스트.
 *
 * 고정하는 것은 **양방향 판정**이다 — 어느 방향 하나만 검사하면 dsh 가 밟은 함정
 * (문서에만 있는 유령 항목 + 문서에 없는 실물)을 절반만 잡는다.
 */
import { describe, it, expect } from 'vitest';
import { checkCacheSurfaceDoc, parseSurfaceDoc, REQUIRED_SUBSECTIONS } from './cacheSurface.js';

const DOC = [
  '# 표면',
  '',
  '<!-- surface: agents -->',
  '## 에이전트',
  '',
  '- **Model Experience**: 본문은 로드되지 않는다.',
  '- **KV Cache effect**: 목록 전체가 프리픽스에 실린다.',
  '',
  '| 에이전트 |',
  '|---|',
  '| `agents/architect.md` |',
  '',
].join('\n');

describe('parseSurfaceDoc', () => {
  it('마커로 절을 식별하고 표의 경로만 뽑는다', () => {
    const [section] = parseSurfaceDoc(DOC);
    expect(section.id).toBe('agents');
    expect(section.entries).toEqual(['agents/architect.md']);
  });
});

describe('checkCacheSurfaceDoc — 양방향', () => {
  it('문서와 실물이 같으면 통과한다', () => {
    expect(checkCacheSurfaceDoc(DOC, { agents: ['agents/architect.md'] })).toEqual([]);
  });

  it('문서에 없는 실물을 잡는다 (자산이 늘었는데 문서가 안 따라온 경우)', () => {
    const f = checkCacheSurfaceDoc(DOC, { agents: ['agents/architect.md', 'agents/tester.md'] });
    expect(f.map((x) => x.code)).toEqual(['undocumented-asset']);
    expect(f[0].message).toContain('agents/tester.md');
  });

  it('실물 없는 문서 항목을 잡는다 (dsh 의 유령 그룹 2개와 같은 고장)', () => {
    const f = checkCacheSurfaceDoc(DOC, { agents: [] });
    expect(f.map((x) => x.code)).toEqual(['phantom-asset']);
  });

  it('필수 절이 비면 잡는다 — 두 질문에 답하지 않은 자산 문서는 통과시키지 않는다', () => {
    const stripped = DOC.replace('- **KV Cache effect**: 목록 전체가 프리픽스에 실린다.', '');
    const f = checkCacheSurfaceDoc(stripped, { agents: ['agents/architect.md'] });
    expect(f.map((x) => x.code)).toContain('missing-subsection');
    expect(f[0].message).toContain(REQUIRED_SUBSECTIONS[1]);
  });

  it('집계 절은 나열을 요구받지 않는다 (actual 에 없는 id 는 건너뛴다)', () => {
    const doc = DOC + '\n<!-- surface: skills -->\n- **Model Experience**: x\n- **KV Cache effect**: y\n';
    expect(checkCacheSurfaceDoc(doc, { agents: ['agents/architect.md'] })).toEqual([]);
  });
});
