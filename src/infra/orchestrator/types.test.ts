import { describe, it, expect } from 'vitest';
import { computeLlmPriority, TASK_LLM_PRIORITY, TASK_TYPES } from './types.js';

/**
 * LLM 라우팅 정책 SSOT 가드 — computeLlmPriority 가 provider 우선순위의 유일 소스이며,
 * 정적 맵(TASK_LLM_PRIORITY)이 여기서 파생되어 절대 어긋나지 않음을 잠근다.
 */
describe('computeLlmPriority (routing policy SSOT)', () => {
  it('falls back to claude-only when no external provider is available', () => {
    for (const t of TASK_TYPES) {
      expect(computeLlmPriority(t, { codex: false, antigravity: false })).toEqual(['claude']);
    }
  });

  it('always ends the chain with claude', () => {
    const avail = { codex: true, antigravity: true };
    for (const t of TASK_TYPES) {
      const chain = computeLlmPriority(t, avail);
      expect(chain[chain.length - 1]).toBe('claude');
    }
  });

  it('puts antigravity first for web-search / uiux', () => {
    const avail = { codex: true, antigravity: true };
    expect(computeLlmPriority('web-search', avail)[0]).toBe('antigravity');
    expect(computeLlmPriority('uiux', avail)[0]).toBe('antigravity');
  });

  it('puts gpt first for gpt-preferred tasks, with antigravity cross-check where configured', () => {
    const avail = { codex: true, antigravity: true };
    expect(computeLlmPriority('architecture', avail)).toEqual(['gpt', 'antigravity', 'claude']);
    expect(computeLlmPriority('debugging', avail)).toEqual(['gpt', 'claude']);
    expect(computeLlmPriority('code-review', avail)).toEqual(['gpt', 'antigravity', 'claude']);
  });

  it('routes general straight to claude even when providers are available', () => {
    expect(computeLlmPriority('general', { codex: true, antigravity: true })).toEqual(['claude']);
  });

  it('honours single-provider availability', () => {
    expect(computeLlmPriority('architecture', { codex: true, antigravity: false })).toEqual(['gpt', 'claude']);
    expect(computeLlmPriority('web-search', { codex: false, antigravity: true })).toEqual(['antigravity', 'claude']);
  });

  it('TASK_LLM_PRIORITY is derived from computeLlmPriority (all-available) — cannot drift', () => {
    for (const t of TASK_TYPES) {
      expect(TASK_LLM_PRIORITY[t]).toEqual(computeLlmPriority(t, { codex: true, antigravity: true }));
    }
  });
});
