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

const SECTION = /^#{1,4}\s*(?:\d+\.\s*)?Agent Contract\s*$/im;

const FIELD_PATTERNS: ReadonlyArray<[keyof AgentContract, RegExp]> = [
  ['allowedTools', /^\s*[-*]\s*\*{0,2}Allowed(?:\s+tools)?\*{0,2}\s*[:：]\s*(.+)$/gim],
  ['forbiddenTools', /^\s*[-*]\s*\*{0,2}Forbidden(?:\s+tools)?\*{0,2}\s*[:：]\s*(.+)$/gim],
  ['irreversibleOps', /^\s*[-*]\s*\*{0,2}Irreversible\*{0,2}\s*[:：]\s*(.+)$/gim],
  ['escalations', /^\s*[-*]\s*\*{0,2}Escalate\*{0,2}\s*[:：]\s*(.+)$/gim],
];

/** 백틱·쉼표 표기를 견딘다. 글롭은 지원하지 않는다 — 정확히 일치만 인정한다 */
function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.replace(/`/g, '').trim())
    .filter((part) => part.length > 0);
}

/** `## Agent Contract` 부터 다음 같은 수준 이상 헤딩 전까지 */
function sectionBody(content: string): string | null {
  const match = content.match(SECTION);
  if (!match || match.index === undefined) return null;
  const after = content.slice(match.index + match[0].length);
  const next = after.search(/^#{1,4}\s+\S/m);
  return next === -1 ? after : after.slice(0, next);
}

/**
 * SPEC 에서 에이전트 계약을 뽑는다.
 *
 * 섹션이 없으면 `null` — 모든 기능에 에이전트가 있는 것은 아니다. 섹션 존재가 곧 스위치인
 * 관례는 `## API Contract` 와 같다 (spec-template).
 */
export function parseAgentContract(specContent: string): AgentContract | null {
  const body = sectionBody(specContent);
  if (body === null) return null;

  const contract: AgentContract = {
    allowedTools: [], forbiddenTools: [], irreversibleOps: [], escalations: [],
  };
  for (const [key, pattern] of FIELD_PATTERNS) {
    for (const line of body.matchAll(pattern)) {
      contract[key].push(...splitList(line[1]));
    }
  }
  // Escalate 는 자유 문장이라 쉼표로 쪼개면 문장이 잘린다 — 원문 줄을 그대로 쓴다
  contract.escalations = [...body.matchAll(FIELD_PATTERNS[3][1])].map((m) => m[1].trim());
  return contract;
}

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
export function validateAgentContract(contract: AgentContract): AgentContractValidation {
  const findings: AgentContractFinding[] = [];
  const forbidden = new Set(contract.forbiddenTools);
  const both = contract.allowedTools.filter((tool) => forbidden.has(tool));

  if (both.length > 0) {
    findings.push({
      severity: 'P1',
      code: 'tool-in-both-lists',
      message: `Allowed 와 Forbidden 에 동시에 있는 도구: ${both.join(', ')} — 어느 쪽이 이기는지 정하지 않는다.`,
    });
  }
  const declared = contract.allowedTools.length + contract.forbiddenTools.length
    + contract.irreversibleOps.length + contract.escalations.length;
  if (declared === 0) {
    findings.push({
      severity: 'P1',
      code: 'empty-agent-contract',
      message: 'Agent Contract 섹션이 비어 있다 — 섹션 존재가 검사 스위치인데 검사할 것이 없다.',
    });
  }
  const orphanIrreversible = contract.irreversibleOps.filter((tool) => forbidden.has(tool));
  if (orphanIrreversible.length > 0) {
    findings.push({
      severity: 'P2',
      code: 'irreversible-also-forbidden',
      message: `금지된 도구가 Irreversible 에도 있다: ${orphanIrreversible.join(', ')} — 승인 규칙이 사문이 된다.`,
    });
  }
  return { valid: !findings.some((f) => f.severity === 'P1'), findings };
}

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

function violationOf(
  call: AgentToolCall,
  index: number,
  contract: AgentContract,
): AgentViolation | null {
  if (contract.forbiddenTools.includes(call.tool)) {
    return { kind: 'forbidden-tool', tool: call.tool, index, detail: '계약이 금지한 도구를 호출했다.' };
  }
  if (contract.irreversibleOps.includes(call.tool) && call.approved !== true) {
    return {
      kind: 'unapproved-irreversible',
      tool: call.tool,
      index,
      detail: '되돌릴 수 없는 작업을 승인 기록 없이 호출했다.',
    };
  }
  // allowlist 미선언(빈 목록)을 "아무것도 허용 안 함" 으로 읽으면 선언하지 않은 프로젝트가 전부 위반이 된다
  if (contract.allowedTools.length > 0 && !contract.allowedTools.includes(call.tool)) {
    return { kind: 'unlisted-tool', tool: call.tool, index, detail: 'allowlist 에 없는 도구를 호출했다.' };
  }
  return null;
}

/**
 * 도구 호출 로그에 대해 계약을 단언한다.
 *
 * 로그가 없으면 `checked: false` — **위반 0건으로 적지 않는다.** 안 본 것과 봤는데 깨끗한 것은
 * 다르다 (회전 비용 계측 축과 같은 규약).
 */
export function checkAgentToolLog(
  contract: AgentContract,
  log?: readonly AgentToolCall[],
): AgentContractCheck {
  const advisory = contract.escalations.map(
    (condition) => `에스컬레이션 조건은 도구 로그로 판정할 수 없다 — 사람이 확인한다: ${condition}`,
  );
  if (!log) {
    return { checked: false, violations: [], advisory, blocking: false };
  }
  const violations: AgentViolation[] = [];
  log.forEach((call, index) => {
    const violation = violationOf(call, index, contract);
    if (violation) violations.push(violation);
  });
  return { checked: true, violations, advisory, blocking: violations.length > 0 };
}
