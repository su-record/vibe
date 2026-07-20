# SPEC: Execution Packet Compiler

- **Created**: 2026-07-20
- **Status**: APPROVED
- **Tech Stack**: TypeScript, Node.js, Vitest, ESM

---

## 1. Overview / Goal

승인된 canonical SPEC을 대상 하네스와 작업 단계에 필요한 작은 execution packet으로 컴파일한다. 압축 과정에서 REQ, 제약 조건, 완료 기준, 증거 계약이 유실되지 않았음을 결정론적으로 검사하고 결과에 원본 추적 정보를 남긴다.

### Context Sources

- https://www.youtube.com/watch?v=J3BbFNYHvZM — 실행 환경별 프롬프트 변환과 컨텍스트 압축 아이디어
- `skills/spec/SKILL.md` — canonical SPEC 생성 계약
- `skills/vibe.run/SKILL.md` — phase/scenario 격리와 재고정 계약
- `skills/vibe.verify/SKILL.md` — criterion별 evidence와 run-ledger 계약
- `vibe/rules/loop-contract.md` — ANCHOR/JUDGE/RECORD 권한 경계
- `vibe/templates/spec-template.md` — canonical SPEC 구조

### Assumptions

- 첫 버전의 대상 프로파일은 `codex`와 `claude-code`다.
- canonical SPEC은 현재 템플릿의 REQ/Done Criteria/Evidence 구조를 따른다.
- packet은 실행 최적화용 파생 아티팩트이며 canonical SPEC을 대체하거나 수정하지 않는다.
- 의미적 품질 평가는 advisory로 남기고, 누락·불일치 차단은 ID와 필드 비교로 판정한다.
- 글자 수를 조용히 잘라내지 않는다. 예산 초과는 분할 결과 또는 명시적 실패가 된다.

### Constraints

- canonical SPEC은 수정하지 않고 packet을 파생 아티팩트로만 생성한다.
- Model Judge는 packet의 완료나 보존 여부를 승인할 수 없다.
- 알 수 없는 ID, 누락된 evidence, stale hash는 fail-closed로 처리한다.
- packet 경로는 프로젝트 내부 `.vibe/packets/`로 제한한다.

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-execution-packet-001 | 동일 입력의 packet 생성이 결정적이어야 한다 | D1 |
| REQ-execution-packet-002 | 선택한 계약과 증거를 원본 추적 정보와 함께 보존해야 한다 | D2, D3 |
| REQ-execution-packet-003 | Codex와 Claude Code 프로파일을 지원해야 한다 | D4 |
| REQ-execution-packet-004 | context budget 초과를 조용히 절단하지 않아야 한다 | D5 |
| REQ-execution-packet-005 | stale 또는 변조된 packet 실행을 차단해야 한다 | D6 |
| REQ-execution-packet-006 | 저장소 품질 게이트를 통과해야 한다 | D7 |

---

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | 동일한 canonical SPEC·profile·compiler version은 byte-identical packet을 생성한다 | deterministic unit test 및 snapshot 비교 |
| D2 | packet에는 선택된 모든 REQ의 constraint, Done Criterion, Evidence Required와 원본 source pointer가 보존된다 | preservation audit unit test |
| D3 | 필수 필드 누락, 알 수 없는 REQ, criterion-evidence 불일치는 컴파일 실패가 된다 | invalid-input table tests |
| D4 | `codex`와 `claude-code` 프로파일은 필수 섹션, context budget, isolation policy를 명시하며 동일한 핵심 계약 집합을 보존한다 | cross-profile contract tests |
| D5 | budget 초과 시 silent truncation 없이 deterministic split 또는 구조화된 오류를 반환한다 | boundary tests |
| D6 | `vibe.run`이 packet 존재 시 원본 SPEC 해시를 검증해 사용하고, stale/invalid packet이면 canonical SPEC으로 조용히 진행하지 않고 재컴파일을 요구한다 | skill contract test/static validation |
| D7 | build와 전체 테스트가 통과한다 | `npm run build && npm test` exit 0 |

### Evidence Required

- D1 → 동일 입력 반복 실행의 byte/snapshot 결과
- D2 → REQ·constraint·criterion·evidence 보존 테스트 결과
- D3 → 각 손실 유형별 실패 코드 테스트 결과
- D4 → 프로파일 schema와 cross-profile 비교 테스트 결과
- D5 → budget 경계값·초과값 테스트 결과
- D6 → `vibe.run` packet 선택·stale 거부 계약 검증 결과
- D7 → build와 전체 Vitest exit code

### Human Taste (Non-Blocking)

- packet이 사람이 디버깅하기 쉬운 구조와 필드명을 사용하는지
- 프로파일 추가 방식이 과도한 설정 부담을 만들지 않는지

---

## 4. Scenarios

```gherkin
Scenario: Canonical SPEC을 Codex execution packet으로 컴파일한다 # → D1, D2
  Given 승인된 SPEC에 REQ, 제약, Done Criteria와 Evidence Required가 있다
  When codex 프로파일로 execution packet을 컴파일한다
  Then packet은 원본 해시와 source pointer를 포함한다
  And 선택된 모든 결정론 계약을 손실 없이 포함한다

Scenario: Claude Code 프로파일도 동일한 핵심 계약을 보존한다 # → D4
  Given 동일한 승인 SPEC이 있다
  When codex와 claude-code 프로파일로 각각 컴파일한다
  Then 프로파일별 실행 메타데이터는 다를 수 있다
  But REQ, 제약, Done Criteria와 Evidence Required 집합은 동일하다

Scenario: 압축 과정의 계약 손실을 차단한다 # → D3
  Given criterion의 Evidence Required가 없거나 알 수 없는 REQ를 참조한다
  When preservation audit을 실행한다
  Then 구조화된 오류 코드와 누락된 source pointer를 반환한다
  And packet을 생성하지 않는다

Scenario: context budget 초과를 명시적으로 처리한다 # → D5
  Given 컴파일 결과가 대상 프로파일의 context budget을 초과한다
  When packet을 컴파일한다
  Then REQ 경계에서 deterministic split하거나 구조화된 초과 오류를 반환한다
  And 문자열을 조용히 절단하지 않는다

Scenario: stale packet 실행을 거부한다 # → D6
  Given packet의 canonical SPEC 해시가 현재 SPEC과 다르다
  When vibe.run이 실행 입력을 고정한다
  Then stale packet을 사용하지 않는다
  And 재컴파일 필요 상태를 명시한다
```

---

## 5. Out of Scope

- 범용 프롬프트 빌더 또는 `vibe init-prompt` 명령
- 질문 80~100개를 사용자에게 노출하는 인터뷰 UI
- Model Judge가 packet 완료 여부를 차단하는 기능
- 이미지·리서치용 프로파일
- 모델별 자동 토큰 계산과 의미 기반 요약
- 메타프롬프팅 효과를 주장하는 대규모 벤치마크

---

## 6. API Contract

```text
compileExecutionPacket({ canonicalSpec, profile, selectedRequirementIds? })
  → { ok: true, packet, audit }
  | { ok: false, errors[] }

packet:
  schemaVersion, compilerVersion, profile, canonicalSpecPath,
  canonicalSpecHash, requirements[], constraints[], doneCriteria[],
  evidenceRequired[], isolationPolicy, contextBudget, sourcePointers[]
```

---

## 7. Verification

- `/vibe.run "execution-packet-compiler"`가 시나리오별로 구현하고 즉시 검증한다.
- `/vibe.verify "execution-packet-compiler"`가 Done Criteria를 판정한다.
- Model Judge는 의미 손실 후보만 제안하며 deterministic preservation audit을 대체하지 않는다.
