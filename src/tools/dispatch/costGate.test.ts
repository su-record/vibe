/**
 * 비용 게이트 테스트.
 *
 * 가장 중요한 성질은 "잡는다" 가 아니라 **의례를 만들지 않는다** 이다 —
 * production 리뷰어 기본 셋(8종)이 매번 멈추면 게이트가 무시당한다.
 */
import { describe, it, expect } from 'vitest';
import { evaluateCostGate, formatCostGate } from './costGate.js';

describe('agent-fanout — 평상시 규모는 통과', () => {
  it.each([
    ['demo 최소 셋', 2],
    ['prototype 축소 셋', 3],
    ['production 기본 셋', 8],
    ['기본 셋 + 조건부', 12],
  ])('%s (%i개) 는 묻지 않는다', (_label, agentCount) => {
    const d = evaluateCostGate({ kind: 'agent-fanout', agentCount });
    expect(d.requiresApproval).toBe(false);
    expect(d.action).toBe('proceed');
  });

  it('임계값을 넘으면 묻는다', () => {
    const d = evaluateCostGate({ kind: 'agent-fanout', agentCount: 13 });
    expect(d.requiresApproval).toBe(true);
    expect(d.action).toBe('ask');
    expect(d.reason).toContain('13');
  });

  it('임계값은 프로젝트가 조정할 수 있다', () => {
    const d = evaluateCostGate(
      { kind: 'agent-fanout', agentCount: 4 },
      { config: { maxAgentsWithoutApproval: 3 } },
    );
    expect(d.action).toBe('ask');
  });
});

describe('paid-generation — 되돌릴 수 없는 지출', () => {
  it('기본적으로 묻는다', () => {
    const d = evaluateCostGate({ kind: 'paid-generation', provider: 'imagegen' });
    expect(d.requiresApproval).toBe(true);
    expect(d.action).toBe('ask');
  });

  it('설정으로 끌 수 있다', () => {
    const d = evaluateCostGate(
      { kind: 'paid-generation' },
      { config: { paidGenerationRequiresApproval: false } },
    );
    expect(d.action).toBe('proceed');
  });
});

describe('automationLevel — 비대화형에서는 묻지 않고 기록한다', () => {
  it('autonomous 는 ask 대신 record', () => {
    const d = evaluateCostGate(
      { kind: 'paid-generation', provider: 'imagegen' },
      { automationLevel: 'autonomous' },
    );
    // 승인 대상이라는 판정 자체는 automationLevel 과 무관하다
    expect(d.requiresApproval).toBe(true);
    expect(d.action).toBe('record');
  });

  it('confirm 이 기본이다', () => {
    expect(evaluateCostGate({ kind: 'paid-generation' }).action).toBe('ask');
  });

  it('승인 대상이 아니면 autonomous 여도 그냥 통과다', () => {
    const d = evaluateCostGate(
      { kind: 'agent-fanout', agentCount: 3 },
      { automationLevel: 'autonomous' },
    );
    expect(d.action).toBe('proceed');
  });
});

describe('게이트 비활성', () => {
  it('enabled:false 면 어떤 작업도 막지 않는다', () => {
    const d = evaluateCostGate(
      { kind: 'paid-generation' },
      { config: { enabled: false } },
    );
    expect(d.requiresApproval).toBe(false);
    expect(d.action).toBe('proceed');
  });
});

describe('formatCostGate', () => {
  it('세 가지 행동을 구분해 출력한다', () => {
    const fanout = { kind: 'agent-fanout' as const, agentCount: 3 };
    expect(formatCostGate(fanout, evaluateCostGate(fanout))).toContain('✅');

    const paid = { kind: 'paid-generation' as const, provider: 'imagegen' };
    expect(formatCostGate(paid, evaluateCostGate(paid))).toContain('⏸️');
    expect(formatCostGate(paid, evaluateCostGate(paid, { automationLevel: 'autonomous' })))
      .toContain('📝');
  });

  it('label 이 있으면 그대로 쓴다', () => {
    const op = { kind: 'paid-generation' as const, label: '배너 이미지 4장 생성' };
    expect(formatCostGate(op, evaluateCostGate(op))).toContain('배너 이미지 4장 생성');
  });
});
