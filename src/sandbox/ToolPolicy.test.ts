/**
 * ToolPolicy Tests — Phase 5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchPattern, ToolPolicyEvaluator, getDefaultSaaSPolicy, getDefaultLocalPolicy } from './ToolPolicy.js';
import type { SandboxLogger } from './types.js';

// ============================================================================
// matchPattern tests
// ============================================================================

describe('matchPattern', () => {
  it('정확한 이름 매칭', () => {
    expect(matchPattern('core_sandbox_exec', 'core_sandbox_exec')).toBe(true);
    expect(matchPattern('core_sandbox_exec', 'core_sandbox_status')).toBe(false);
  });

  it('와일드카드 패턴 매칭', () => {
    expect(matchPattern('core_browser_*', 'core_browser_snapshot')).toBe(true);
    expect(matchPattern('core_browser_*', 'core_browser_act')).toBe(true);
    expect(matchPattern('core_browser_*', 'core_google_auth')).toBe(false);
  });

  it('그룹 매칭: group:browser', () => {
    expect(matchPattern('group:browser', 'core_browser_snapshot')).toBe(true);
    expect(matchPattern('group:browser', 'core_browser_act')).toBe(true);
    expect(matchPattern('group:browser', 'core_browser_navigate')).toBe(true);
    expect(matchPattern('group:browser', 'core_google_auth')).toBe(false);
  });

  it('그룹 매칭: group:google', () => {
    expect(matchPattern('group:google', 'core_google_auth')).toBe(true);
    expect(matchPattern('group:google', 'core_google_gmail_send')).toBe(true);
    expect(matchPattern('group:google', 'core_browser_act')).toBe(false);
  });

  it('그룹 매칭: group:voice', () => {
    expect(matchPattern('group:voice', 'core_voice_status')).toBe(true);
    expect(matchPattern('group:voice', 'core_tts_speak')).toBe(true);
    expect(matchPattern('group:voice', 'core_stt_transcribe')).toBe(true);
    expect(matchPattern('group:voice', 'core_browser_act')).toBe(false);
  });

  it('그룹 매칭: group:vision', () => {
    expect(matchPattern('group:vision', 'core_vision_start')).toBe(true);
    expect(matchPattern('group:vision', 'core_vision_stop')).toBe(true);
    expect(matchPattern('group:vision', 'core_browser_act')).toBe(false);
  });

  it('그룹 매칭: group:fs', () => {
    expect(matchPattern('group:fs', 'core_find_symbol')).toBe(true);
    expect(matchPattern('group:fs', 'core_find_references')).toBe(true);
    expect(matchPattern('group:fs', 'core_analyze_dependency_graph')).toBe(true);
    expect(matchPattern('group:fs', 'core_browser_act')).toBe(false);
  });

  it('그룹 매칭: group:runtime', () => {
    expect(matchPattern('group:runtime', 'core_sandbox_exec')).toBe(true);
    expect(matchPattern('group:runtime', 'core_browser_act')).toBe(false);
  });

  it('존재하지 않는 그룹', () => {
    expect(matchPattern('group:nonexistent', 'core_browser_act')).toBe(false);
  });

  it('전체 와일드카드', () => {
    expect(matchPattern('*', 'core_any_tool')).toBe(true);
    expect(matchPattern('*', 'anything')).toBe(true);
  });
});

// ============================================================================
// ToolPolicyEvaluator tests
// ============================================================================

describe('ToolPolicyEvaluator', () => {
  let logger: SandboxLogger;
  let evaluator: ToolPolicyEvaluator;

  beforeEach(() => {
    logger = vi.fn();
    evaluator = new ToolPolicyEvaluator(logger);
  });

  describe('기본 정책 평가', () => {
    it('일치하는 규칙이 없으면 deny', () => {
      evaluator.setLayers([]);
      const result = evaluator.evaluate('core_unknown_tool');
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('deny');
    });

    it('allow 규칙 매칭', () => {
      evaluator.setLayers([{
        level: 'profile',
        rules: [{ pattern: 'core_browser_*', action: 'allow' }],
      }]);
      const result = evaluator.evaluate('core_browser_snapshot');
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('allow');
      expect(result.matchedLevel).toBe('profile');
    });

    it('deny 규칙 매칭', () => {
      evaluator.setLayers([{
        level: 'global',
        rules: [{ pattern: 'core_sandbox_exec', action: 'deny', reason: 'blocked' }],
      }]);
      const result = evaluator.evaluate('core_sandbox_exec');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blocked');
    });

    it('ask 규칙 매칭', () => {
      evaluator.setLayers([{
        level: 'global',
        rules: [{ pattern: 'core_sandbox_exec', action: 'ask', reason: '승인 필요' }],
      }]);
      const result = evaluator.evaluate('core_sandbox_exec');
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('ask');
    });
  });

  describe('6단계 체인 평가', () => {
    it('Profile → Global → User → Channel → Sandbox → SubAgent 순서', () => {
      // addLayer는 자동 정렬 → profile이 sandbox보다 우선
      evaluator.addLayer({ level: 'sandbox', rules: [{ pattern: 'core_browser_*', action: 'deny' }] });
      evaluator.addLayer({ level: 'profile', rules: [{ pattern: 'core_browser_*', action: 'allow' }] });
      // profile이 먼저 평가됨 → allow
      const result = evaluator.evaluate('core_browser_snapshot');
      expect(result.allowed).toBe(true);
      expect(result.matchedLevel).toBe('profile');
    });

    it('첫 번째 매칭 규칙이 결과를 결정', () => {
      evaluator.setLayers([
        { level: 'profile', rules: [{ pattern: 'core_google_*', action: 'allow' }] },
        { level: 'global', rules: [{ pattern: 'core_google_auth', action: 'deny' }] },
      ]);
      // profile의 와일드카드가 먼저 매칭
      const result = evaluator.evaluate('core_google_auth');
      expect(result.allowed).toBe(true);
    });

    it('addLayer로 정렬 유지', () => {
      evaluator.addLayer({ level: 'sandbox', rules: [{ pattern: '*', action: 'deny' }] });
      evaluator.addLayer({ level: 'profile', rules: [{ pattern: '*', action: 'allow' }] });

      // profile이 sandbox보다 우선
      const result = evaluator.evaluate('any_tool');
      expect(result.allowed).toBe(true);
      expect(result.matchedLevel).toBe('profile');
    });
  });

  describe('그룹 규칙', () => {
    it('그룹 기반 허용', () => {
      evaluator.setLayers([{
        level: 'profile',
        rules: [{ pattern: 'group:browser', action: 'allow' }],
      }]);
      expect(evaluator.evaluate('core_browser_snapshot').allowed).toBe(true);
      expect(evaluator.evaluate('core_browser_act').allowed).toBe(true);
      expect(evaluator.evaluate('core_google_auth').allowed).toBe(false);
    });
  });

  describe('getLayers', () => {
    it('설정된 레이어를 반환 (복사본)', () => {
      const layers = [{ level: 'profile' as const, rules: [] }];
      evaluator.setLayers(layers);
      const returned = evaluator.getLayers();
      expect(returned).toEqual(layers);
      expect(returned).not.toBe(layers); // 복사본
    });
  });
});

// ============================================================================
// Default Policies tests
// ============================================================================

describe('getDefaultSaaSPolicy', () => {
  it('browser, google, voice, vision 그룹 허용', () => {
    const layers = getDefaultSaaSPolicy();
    expect(layers.length).toBeGreaterThanOrEqual(2);

    const logger = vi.fn() as SandboxLogger;
    const evaluator = new ToolPolicyEvaluator(logger);
    evaluator.setLayers(layers);

    expect(evaluator.evaluate('core_browser_snapshot').allowed).toBe(true);
    expect(evaluator.evaluate('core_google_auth').allowed).toBe(true);
    expect(evaluator.evaluate('core_voice_status').allowed).toBe(true);
    expect(evaluator.evaluate('core_vision_start').allowed).toBe(true);
  });

  it('sandbox_exec는 ask', () => {
    const layers = getDefaultSaaSPolicy();
    const logger = vi.fn() as SandboxLogger;
    const evaluator = new ToolPolicyEvaluator(logger);
    evaluator.setLayers(layers);

    const result = evaluator.evaluate('core_sandbox_exec');
    expect(result.action).toBe('ask');
  });
});

describe('getDefaultLocalPolicy', () => {
  it('모든 도구 허용', () => {
    const layers = getDefaultLocalPolicy();
    const logger = vi.fn() as SandboxLogger;
    const evaluator = new ToolPolicyEvaluator(logger);
    evaluator.setLayers(layers);

    expect(evaluator.evaluate('core_browser_snapshot').allowed).toBe(true);
    expect(evaluator.evaluate('core_sandbox_exec').allowed).toBe(true);
    expect(evaluator.evaluate('unknown_tool').allowed).toBe(true);
  });
});
