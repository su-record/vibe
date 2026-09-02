import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseAgentContract,
  validateAgentContract,
  checkAgentToolLog,
} from './agentContract.js';
import type { AgentContract, AgentToolCall } from './agentContract.js';

/**
 * SPEC: .vibe/specs/agent-contract-runtime.md (DC-1 ~ DC-8).
 *
 * 정책 단언 둘은 값을 박는다 — "로그 없음은 위반 0건이 아니다" 와 "Escalate 는 차단하지
 * 않는다". 임의의 선택이 아니라 loop-contract Judge 권한 경계를 코드로 내린 결정이다.
 */

const ROOT = path.resolve(__dirname, '..', '..', '..');

const SPEC_WITH = `# SPEC: 결제 도우미

## 5. Out of Scope

- 없음

## 7. Agent Contract

- **Allowed tools**: \`read_invoice\`, \`search_orders\`, \`charge_card\`
- **Forbidden tools**: \`delete_account\`, \`send_email\`
- **Irreversible**: \`charge_card\`
- **Escalate**: 결제 금액이 사용자 한도를 넘으면 사람에게 묻는다

## 8. Verification
`;

const SPEC_WITHOUT = `# SPEC: 정적 페이지\n\n## 7. Verification\n\n- 없음\n`;

function contractOf(spec: string): AgentContract {
  const parsed = parseAgentContract(spec);
  expect(parsed, '계약을 파싱하지 못했다').not.toBeNull();
  return parsed as AgentContract;
}

describe('DC-1 · DC-2 — 파싱', () => {
  it('4종 항목을 목록으로 뽑는다', () => {
    const c = contractOf(SPEC_WITH);
    expect(c.allowedTools).toEqual(['read_invoice', 'search_orders', 'charge_card']);
    expect(c.forbiddenTools).toEqual(['delete_account', 'send_email']);
    expect(c.irreversibleOps).toEqual(['charge_card']);
    expect(c.escalations).toHaveLength(1);
  });

  it('에스컬레이션은 문장이므로 쉼표로 쪼개지 않는다', () => {
    const c = contractOf('## Agent Contract\n\n- **Escalate**: 금액이 크면, 사람에게 묻는다\n');
    expect(c.escalations).toEqual(['금액이 크면, 사람에게 묻는다']);
  });

  it('섹션이 없으면 null — 모든 기능에 에이전트가 있는 것은 아니다', () => {
    expect(parseAgentContract(SPEC_WITHOUT)).toBeNull();
  });

  it('다음 헤딩을 넘어 읽지 않는다', () => {
    const c = contractOf(SPEC_WITH);
    expect(c.allowedTools).not.toContain('Verification');
  });
});

describe('DC-3 — 정의 가드', () => {
  it('정상 계약은 통과한다', () => {
    expect(validateAgentContract(contractOf(SPEC_WITH)).valid).toBe(true);
  });

  it('Allowed 와 Forbidden 에 동시에 있으면 P1 — 우선순위를 정하지 않는다', () => {
    const result = validateAgentContract({
      allowedTools: ['send_email'], forbiddenTools: ['send_email'], irreversibleOps: [], escalations: [],
    });
    expect(result.valid).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('tool-in-both-lists');
  });

  it('빈 계약은 P1 — 섹션 존재가 스위치인데 검사할 것이 없다', () => {
    const result = validateAgentContract({
      allowedTools: [], forbiddenTools: [], irreversibleOps: [], escalations: [],
    });
    expect(result.findings.map((f) => f.code)).toContain('empty-agent-contract');
  });

  it('금지 도구가 Irreversible 에도 있으면 P2 — 통과는 막지 않는다', () => {
    const result = validateAgentContract({
      allowedTools: [], forbiddenTools: ['wipe'], irreversibleOps: ['wipe'], escalations: [],
    });
    expect(result.valid).toBe(true);
    expect(result.findings.map((f) => f.code)).toContain('irreversible-also-forbidden');
  });
});

describe('DC-4 — 위반은 관측된 사실이므로 차단한다', () => {
  const contract = contractOf(SPEC_WITH);

  it('금지 도구 호출을 잡는다', () => {
    const log: AgentToolCall[] = [{ tool: 'read_invoice' }, { tool: 'send_email' }];
    const result = checkAgentToolLog(contract, log);
    expect(result.blocking).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ kind: 'forbidden-tool', tool: 'send_email', index: 1 });
  });

  it('allowlist 밖 호출을 잡는다', () => {
    const result = checkAgentToolLog(contract, [{ tool: 'exec_shell' }]);
    expect(result.violations[0].kind).toBe('unlisted-tool');
  });

  it('승인 없는 되돌릴 수 없는 호출을 잡는다', () => {
    const result = checkAgentToolLog(contract, [{ tool: 'charge_card' }]);
    expect(result.violations[0].kind).toBe('unapproved-irreversible');
  });

  it('승인된 되돌릴 수 없는 호출은 위반이 아니다', () => {
    const result = checkAgentToolLog(contract, [{ tool: 'charge_card', approved: true }]);
    expect(result.violations).toHaveLength(0);
    expect(result.blocking).toBe(false);
  });

  it('깨끗한 로그는 checked:true · blocking:false', () => {
    const result = checkAgentToolLog(contract, [{ tool: 'read_invoice' }, { tool: 'search_orders' }]);
    expect(result.checked).toBe(true);
    expect(result.blocking).toBe(false);
  });

  it('위반 위치를 로그 인덱스로 짚는다', () => {
    const log: AgentToolCall[] = [{ tool: 'read_invoice' }, { tool: 'read_invoice' }, { tool: 'delete_account' }];
    expect(checkAgentToolLog(contract, log).violations[0].index).toBe(2);
  });
});

describe('DC-5 — allowlist 미선언', () => {
  it('빈 allowlist 를 "아무것도 허용 안 함" 으로 읽지 않는다', () => {
    const contract: AgentContract = {
      allowedTools: [], forbiddenTools: ['wipe'], irreversibleOps: [], escalations: [],
    };
    const result = checkAgentToolLog(contract, [{ tool: 'anything' }, { tool: 'whatever' }]);
    expect(result.violations).toHaveLength(0);
  });

  it('미선언이어도 금지 목록은 여전히 강제된다', () => {
    const contract: AgentContract = {
      allowedTools: [], forbiddenTools: ['wipe'], irreversibleOps: [], escalations: [],
    };
    expect(checkAgentToolLog(contract, [{ tool: 'wipe' }]).violations[0].kind).toBe('forbidden-tool');
  });
});

describe('DC-6 — 로그 없음은 위반 0건이 아니다 (정책 단언)', () => {
  // 회전 비용 계측 축과 같은 규약. 뒤집으려면 이 테스트를 의도적으로 지워야 한다.
  it('로그를 넘기지 않으면 checked:false · blocking:false', () => {
    const result = checkAgentToolLog(contractOf(SPEC_WITH));
    expect(result.checked).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('빈 로그는 검사한 것이다 — 넘기지 않은 것과 구분한다', () => {
    const result = checkAgentToolLog(contractOf(SPEC_WITH), []);
    expect(result.checked).toBe(true);
  });
});

describe('DC-7 — Escalate 는 게이트가 아니다 (정책 단언)', () => {
  it('advisory 로만 나가고 위반을 만들지 않는다', () => {
    const result = checkAgentToolLog(contractOf(SPEC_WITH), [{ tool: 'read_invoice' }]);
    expect(result.advisory).toHaveLength(1);
    expect(result.advisory[0]).toContain('사람이 확인한다');
    expect(result.violations).toHaveLength(0);
    expect(result.blocking).toBe(false);
  });

  it('로그가 없어도 advisory 는 나온다 — 선언 자체가 사람에게 갈 정보다', () => {
    expect(checkAgentToolLog(contractOf(SPEC_WITH)).advisory).toHaveLength(1);
  });
});

describe('DC-8 — 템플릿·스킬 배선', () => {
  const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

  it('SPEC 템플릿에 Agent Contract 절이 스위치로 적혀 있다', () => {
    const doc = read('vibe/templates/spec-template.md');
    expect(doc).toMatch(/##\s*\d+\.\s*Agent Contract/);
    expect(doc).toContain('Allowed tools');
    expect(doc).toContain('Escalate');
  });

  it('vibe.contract 에 agent 서브커맨드와 위반 3종이 있다', () => {
    const doc = read('skills/vibe.contract/SKILL.md');
    expect(doc).toMatch(/\/vibe\.contract agent/);
    for (const kind of ['forbidden-tool', 'unlisted-tool', 'unapproved-irreversible']) {
      expect(doc).toContain(kind);
    }
  });

  it('LLM 채점이 아니라 도구 로그가 판정 대상임을 본문이 말한다', () => {
    const doc = read('skills/vibe.contract/SKILL.md');
    expect(doc).toMatch(/LLM 이 에이전트 응답을 채점하지 않는다/);
    expect(doc).toMatch(/Escalate` 는 게이트가 아니다/);
  });

  it('vibe.spec 이 Agent Contract 작성과 체인을 지시한다', () => {
    const doc = read('skills/vibe.spec/SKILL.md');
    expect(doc).toContain('**Agent Contract**');
    expect(doc).toMatch(/\/vibe\.contract agent` 도 함께 체인한다/);
  });
});
