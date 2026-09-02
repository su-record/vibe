/**
 * AGENTS.md 생성기 테스트.
 *
 * 고정하는 것은 **불변식**이다: 보호 리터럴은 살아남고, override 는 정확히 한 번 잡힌다.
 * 어떤 토큰을 보호하는지·무엇을 갈아끼우는지는 `scripts/agents-md-rules.json` 의 선택이므로
 * 여기에 값을 박지 않는다 — 박으면 규칙을 바꿀 때마다 테스트가 "되돌려라" 를 요구한다.
 */
import { describe, it, expect } from 'vitest';
import { generateAgentsMd, type AgentsMdRules } from './agentsMd.js';

const RULES: AgentsMdRules = {
  protect: ['@su-record/vibe', 'plugins/vibe'],
  substitutions: [{ find: '/vibe', replace: '$vibe', why: 'test' }],
  overrides: [{ find: 'HOME: `$vibe`', replace: 'HOME: skills', why: 'test' }],
};

describe('generateAgentsMd', () => {
  it('슬래시 명령만 번역하고 보호 리터럴은 건드리지 않는다', () => {
    const src = 'run `/vibe.spec` from `@su-record/vibe` in `plugins/vibe/dist/`';
    const { output, findings } = generateAgentsMd(src, { ...RULES, overrides: [] });
    expect(findings).toEqual([]);
    expect(output).toBe('run `$vibe.spec` from `@su-record/vibe` in `plugins/vibe/dist/`');
  });

  it('override 는 치환 이후 텍스트에 적용된다', () => {
    const { output } = generateAgentsMd('HOME: `/vibe`', RULES);
    expect(output).toBe('HOME: skills');
  });

  it('대상을 잃은 override 를 잡는다 (원문이 바뀌었는데 규칙이 안 따라온 경우)', () => {
    const { findings } = generateAgentsMd('nothing to match', RULES);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('0번');
  });

  it('너무 많이 잡는 override 도 잡는다 (의도하지 않은 곳까지 갈아끼운다)', () => {
    const { findings, output } = generateAgentsMd('HOME: `/vibe` and HOME: `/vibe`', RULES);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('2번');
    expect(output).toContain('HOME: `$vibe`');   // 매치가 애매하면 갈아끼우지 않는다
  });

  it('보호는 긴 리터럴부터 적용된다 (짧은 쪽이 먼저 먹으면 긴 쪽이 깨진다)', () => {
    const rules: AgentsMdRules = { ...RULES, protect: ['su-record/vibe', '@su-record/vibe'], overrides: [] };
    expect(generateAgentsMd('`@su-record/vibe`', rules).output).toBe('`@su-record/vibe`');
  });
});
