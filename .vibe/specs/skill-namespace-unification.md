# SPEC: Skill Namespace Unification

- **Created**: 2026-07-20
- **Status**: APPROVED
- **Tech Stack**: TypeScript, Node.js, Markdown, Vitest

---

## 1. Overview / Goal

Vibe 패키지가 소유한 모든 내장 스킬을 `vibe.` namespace 아래로 통일한다. 공개 entry와 내부 body/support 스킬이 bare 이름으로 함께 노출되는 현재 구조를 제거하고, 설치·카탈로그·체인 호출·검증 로직이 동일한 명명 계약을 사용하게 한다.

### Context Sources

- `skills/*/SKILL.md` — 61개 내장 스킬의 디렉터리명과 frontmatter name SSOT
- `src/cli/postinstall/constants.ts` — 전역·optional·stack·capability 설치 목록
- `src/cli/postinstall/fs-utils.ts` — 스킬 복사, 소유권 판정, Codex invocation policy
- `scripts/gen-skill-docs.ts` — 스킬 카탈로그 생성
- `scripts/validate-skill-invocation.ts` — 스킬 호출 계약 검증
- `skills/vibe.*` — 공개 wrapper와 내부 body 체인 참조

### Assumptions

- 외부 discovery에 설치되는 Vibe 스킬 이름은 모두 `vibe` 또는 `vibe.`로 시작해야 한다.
- 공개 wrapper와 내부 body가 분리된 7개 스킬은 공개 `vibe.*` 하나로 통합한다.
- `arch-guard`, `exec-plan`, `restraint` 본문은 `vibe.run` 내부 섹션으로 통합하고 별도 스킬로 설치하지 않는다.
- 그 밖의 외부 support/optional/stack/capability 스킬은 `vibe.<name>`을 사용한다.
- 최종 스킬 이름은 `vibe.` prefix를 포함해 32자를 넘지 않는다. 긴 이름은 의미를 보존한 짧은 alias를 사용한다.
- 외부 공급자가 소유한 `STACK_TO_EXTERNAL_SKILLS`와 `CAPABILITY_EXTERNAL_SKILLS` 값은 rename하지 않는다.
- 기존 bare 설치본은 Vibe 소유가 확인되는 경우에만 update/postinstall에서 제거한다.

### Constraints

- 기존 공개 entry 이름 `vibe`, `vibe.*`는 유지한다.
- 디렉터리명과 `SKILL.md` frontmatter `name`은 항상 일치해야 한다.
- wrapper가 내부 body를 호출하는 모든 참조를 새 이름으로 갱신한다.
- dotted skill name을 invocation parser가 완전하게 인식해야 한다.
- 이름 축약은 디렉터리명, frontmatter, 설치 상수, 체인 참조에 동일하게 적용한다.
- 기존 curated-release-notes 미커밋 변경은 수정하지 않는다.
- 설치된 `~/.codex`, `~/.claude`, `~/.vibe` 사본을 직접 수정하지 않는다.

---

## 2. Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-skill-namespace-001 | 모든 외부 노출 Vibe 스킬의 이름을 짧은 `vibe` namespace로 통일한다 | D1, D2 |
| REQ-skill-namespace-002 | 공개 wrapper와 내부 body의 이름 충돌 없이 체인 호출을 유지한다 | D2, D3 |
| REQ-skill-namespace-003 | 모든 설치 상수와 로컬 스킬 매핑에서 bare Vibe 이름을 제거한다 | D4 |
| REQ-skill-namespace-004 | 기존 bare Vibe 설치본을 소유권 확인 후 안전하게 정리한다 | D5 |
| REQ-skill-namespace-005 | 카탈로그와 invocation validator가 dotted namespace를 정확히 처리한다 | D6, D7 |
| REQ-skill-namespace-006 | 문서와 테스트가 단일 공개 명명 계약을 보장한다 | D8, D9 |

---

## 3. Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | 외부 discovery 설치 대상이 모두 `vibe` 또는 `vibe.` frontmatter name을 가지며 이름 길이가 32자 이하이다 | namespace audit test |
| D2 | 모든 skill directory basename이 frontmatter name과 일치하고 중복 이름이 없다 | namespace audit test |
| D3 | 기존 wrapper/body 7쌍이 중복 없는 단일 `vibe.*` 스킬로 통합된다 | invocation validation test |
| D4 | internal/external provider 목록을 제외한 모든 Vibe 설치 상수 값이 `vibe` namespace를 사용한다 | constants unit test |
| D5 | legacy bare 디렉터리는 Vibe ownership marker가 일치할 때만 제거되고 사용자 소유 디렉터리는 보존된다 | installer migration tests |
| D6 | 생성된 `SKILL-CATALOG.md`가 공개 entry를 Global로 분류하고 Vibe-owned `(unrouted)` 항목을 만들지 않는다 | catalog freshness + content test |
| D7 | invocation parser가 dotted `vibe.*` 전체 이름을 절단 없이 검증한다 | validator unit tests |
| D8 | README/CLAUDE/AGENTS의 직접 호출 예시에 bare Vibe skill invocation이 없다 | documentation contract test |
| D9 | `pnpm build`, 전체 Vitest, skill invocation/count/catalog 검증이 모두 exit 0이다 | repository quality commands |

### Evidence Required

- D1 → 외부 discovery 설치 대상 namespace audit 결과
- D2 → 디렉터리명, frontmatter name, 중복 검사 결과
- D3 → wrapper/body 통합 및 invocation validation 결과
- D4 → postinstall constants namespace unit test 결과
- D5 → legacy ownership migration 테스트 결과
- D6 → `pnpm gen:skill-docs:check`와 catalog content test
- D7 → dotted invocation parser unit test 결과
- D8 → documentation contract test
- D9 → build, full test, validation command exit codes

### Human Taste (Non-Blocking)

- `/skills`에서 Vibe 소유권과 공개/내부 역할이 이름만으로 명확한지
- 내부 core가 `/skills`에 별도 항목으로 노출되지 않는지

---

## 4. Scenarios

```gherkin
Scenario: 모든 내장 스킬을 Vibe namespace로 식별한다 # → D1, D2
  Given 외부 discovery 설치 대상 스킬을 전수 검사한다
  When 설치 이름과 frontmatter name을 수집한다
  Then 모든 외부 이름은 vibe 또는 vibe.로 시작한다
  And 디렉터리명과 frontmatter name이 일치하며 중복이 없다

Scenario: wrapper와 내부 본체를 충돌 없이 연결한다 # → D3
  Given vibe.spec 공개 wrapper와 spec 내부 본체가 있다
  When 두 스킬을 통합한다
  Then vibe.spec 하나만 남는다
  And 별도 core 스킬은 외부에 노출되지 않는다

Scenario: 설치 대상에 bare Vibe 이름을 남기지 않는다 # → D4, D5
  Given 전역, optional, stack, capability 설치 목록과 기존 설치 디렉터리가 있다
  When postinstall 또는 update가 실행된다
  Then Vibe 소유 설치 이름은 모두 namespace 규칙을 따른다
  And 소유권이 확인된 legacy bare 디렉터리만 제거된다

Scenario: 카탈로그와 호출 검증이 dotted 이름을 보존한다 # → D6, D7
  Given 통합된 vibe.spec 체인 참조가 있다
  When 카탈로그와 invocation validator를 실행한다
  Then 전체 dotted 이름이 정확히 라우팅된다
  And Vibe-owned unrouted 항목은 없다

Scenario: 공개 문서와 품질 게이트를 유지한다 # → D8, D9
  Given namespace migration이 완료됐다
  When 문서 계약, build, 전체 테스트와 검증 명령을 실행한다
  Then bare Vibe 직접 호출 예시는 없다
  And 모든 결정론적 게이트가 통과한다
```

---

## 5. Out of Scope

- 외부 공급자 스킬과 `skills.sh` 패키지 이름 변경
- 설치된 사용자 홈 디렉터리의 사본을 직접 수정
- Vibe 이외 플러그인의 namespace 정책 변경
- 공개 entry의 기능 또는 workflow 동작 변경
- 기존 curated-release-notes 구현 변경

---

## 6. Verification

- namespace audit와 installer migration 테스트를 실패 상태로 먼저 추가한다.
- 각 rename 단위마다 wrapper chain과 관련 테스트를 즉시 검증한다.
- 카탈로그를 재생성하고 freshness·count·invocation validation을 실행한다.
- `pnpm build && pnpm test -- --reporter=default`로 전체 회귀를 확인한다.
