/**
 * 에이전트 계약 — 런타임 축을 **빌드타임에** 잡는다.
 *
 * vibe 는 빌드타임만 다룬다. 그런데 사용자가 만드는 것이 에이전트 제품일 때, 그 에이전트가
 * 사용자 앞에서 내리는 판단은 vibe 의 어떤 게이트도 보지 않는다. 그렇다고 vibe 를 런타임에
 * 넣으면 loop-contract 의 push·release·배포 금지를 정면으로 깬다. 그래서 vibe 가 런타임에
 * 들어가는 대신 **런타임 게이트를 빌드타임에 생성**한다.
 *
 * **판정 대상이 도구 호출 로그인 것이 핵심이다.** LLM 이 에이전트의 출력을 채점하는 형태였다면
 * 그것은 Model Judge 이고 완료 권한이 없다 (loop-contract Judge 권한 경계). "금지된 도구를
 * 불렀는가" 는 관측된 사실이라 차단할 수 있다.
 *
 * 그래서 이 모듈은 `reverseDrift.ts` 와 **반대 방향의 결정**을 한다. 거기서는 `blocking: false`
 * 가 리터럴 타입이라 차단하는 분류를 만들 수 없다 — 판정 주체가 LLM 추출이기 때문이다.
 * 여기서는 차단이 정당하다 — 판정 주체가 로그이기 때문이다. 두 파일의 차이가 곧 권한 경계의
 * 예시다.
 *
 * 판정할 수 없는 것은 게이트로 만들지 않는다: 에스컬레이션 조건("결제가 임계를 넘으면 사람에게
 * 묻는다")은 조건 충족 여부가 로그에 없다. 선언은 받되 advisory 로 낸다 — 억지로 게이트에
 * 넣으면 통과 의식이 되고, 그건 없는 게이트보다 나쁘다.
 */
export interface AgentContract {
    /** 비어 있으면 allowlist 미선언 — 미등재 호출을 검사하지 않는다 */
    allowedTools: string[];
    forbiddenTools: string[];
    /** 되돌릴 수 없는 작업 — 호출에 승인 기록이 있어야 한다 */
    irreversibleOps: string[];
    /** 선언만 받는다. 도구 로그로는 판정할 수 없다 (advisory) */
    escalations: string[];
}
/**
 * SPEC 에서 에이전트 계약을 뽑는다.
 *
 * 섹션이 없으면 `null` — 모든 기능에 에이전트가 있는 것은 아니다. 섹션 존재가 곧 스위치인
 * 관례는 `## API Contract` 와 같다 (spec-template).
 */
export declare function parseAgentContract(specContent: string): AgentContract | null;
export type AgentContractFindingSeverity = 'P1' | 'P2';
export interface AgentContractFinding {
    severity: AgentContractFindingSeverity;
    code: string;
    message: string;
}
export interface AgentContractValidation {
    valid: boolean;
    findings: AgentContractFinding[];
}
/**
 * 계약 정의 자체의 오류를 잡는다 (노드 가드).
 *
 * Allowed 와 Forbidden 이 겹칠 때 우선순위 규칙을 두지 않는 이유: 규칙을 기억해야 판정을
 * 예측할 수 있고, 기억이 필요한 규칙은 틀린다. 정의 단계에서 막는다.
 */
export declare function validateAgentContract(contract: AgentContract): AgentContractValidation;
/** 에이전트 실행이 남긴 도구 호출 1건 — vibe 자신의 로그 형식을 쓴다 (step-counter) */
export interface AgentToolCall {
    tool: string;
    /** 되돌릴 수 없는 작업이 승인을 받았는가 */
    approved?: boolean;
    ts?: string;
}
export type AgentViolationKind = 'forbidden-tool' | 'unlisted-tool' | 'unapproved-irreversible';
export interface AgentViolation {
    kind: AgentViolationKind;
    tool: string;
    /** 로그에서 몇 번째 호출인가 (0-indexed) */
    index: number;
    detail: string;
}
export interface AgentContractCheck {
    /** 로그가 있어 실제로 검사했는가. `false` 는 **위반 0건이 아니다** */
    checked: boolean;
    violations: AgentViolation[];
    /** 도구 로그로는 판정할 수 없어 사람 리뷰로 넘긴 항목 */
    advisory: string[];
    /** 관측된 위반이므로 차단이 정당하다 — reverseDrift 와 반대 방향의 결정 */
    blocking: boolean;
}
/**
 * 도구 호출 로그에 대해 계약을 단언한다.
 *
 * 로그가 없으면 `checked: false` — **위반 0건으로 적지 않는다.** 안 본 것과 봤는데 깨끗한 것은
 * 다르다 (회전 비용 계측 축과 같은 규약).
 */
export declare function checkAgentToolLog(contract: AgentContract, log?: readonly AgentToolCall[]): AgentContractCheck;
//# sourceMappingURL=agentContract.d.ts.map