/**
 * 비용 게이트 — 되돌리기 어렵거나 비싼 노드 **직전**에 사람을 세운다.
 *
 * 배경: loop-contract 의 사람 개입은 SPEC 승인 1회뿐이었다. 승인 이후에는
 * max_iterations 까지 무인이고, 그 안에 유료 생성이나 대규모 팬아웃이 승인 없이
 * 실행된다. 시작점에만 게이트를 두면 "얼마나 쓸지" 를 아무도 보지 못한다.
 *
 * 설계 원칙 두 가지:
 *  1. **의례를 만들지 않는다.** production 리뷰어 기본 셋이 8종이므로 임계값을
 *     그 아래로 두면 매 리뷰가 멈춘다. 평상시 규모는 통과시키고 이상한 규모만 잡는다.
 *     "SPEC 승인이 유일한 의무 게이트" 라는 계약은 보통의 실행에서 그대로 유지된다.
 *  2. **판정은 코드가 한다.** 에이전트 수·유료 여부는 세면 되는 값이다.
 *
 * autonomous 는 묻지 않는다 — 대신 결정을 기록해 인박스에서 보이게 한다.
 */
export type CostOperationKind = 'agent-fanout' | 'paid-generation';
export type AutomationLevel = 'confirm' | 'autonomous';
export type CostGateAction = 'ask' | 'record' | 'proceed';
export interface CostOperation {
    kind: CostOperationKind;
    /** agent-fanout: 스폰할 에이전트 수 */
    agentCount?: number;
    /** paid-generation: 제공자/모델 (보고용) */
    provider?: string;
    /** 사람이 읽을 작업 설명 */
    label?: string;
}
export interface CostGateConfig {
    /** 게이트 자체 on/off — 기본 on */
    enabled?: boolean;
    /**
     * 이 수를 **넘으면** 승인을 묻는다. 기본 12 —
     * production 기본 리뷰어 셋(8종) + 조건부 몇 개는 평상시 규모라 통과시킨다.
     */
    maxAgentsWithoutApproval?: number;
    /** 유료 생성에 승인을 요구할지 — 기본 true (되돌릴 수 없는 지출) */
    paidGenerationRequiresApproval?: boolean;
}
export interface CostGateDecision {
    /** 사람 승인이 필요한 작업인가 (automationLevel 과 무관한 판정) */
    requiresApproval: boolean;
    /** automationLevel 까지 반영한 실제 행동 */
    action: CostGateAction;
    reason: string;
}
/**
 * 이 작업이 승인 대상인지, 그리고 지금 무엇을 해야 하는지 판정한다.
 *
 * @param op 실행 직전의 작업 서술
 * @param options.config `.vibe/config.json` 의 `costGate`
 * @param options.automationLevel `confirm`(기본) / `autonomous`
 */
export declare function evaluateCostGate(op: CostOperation, options?: {
    config?: CostGateConfig;
    automationLevel?: AutomationLevel;
}): CostGateDecision;
/** 스킬이 그대로 출력하는 한 줄 */
export declare function formatCostGate(op: CostOperation, decision: CostGateDecision): string;
//# sourceMappingURL=costGate.d.ts.map