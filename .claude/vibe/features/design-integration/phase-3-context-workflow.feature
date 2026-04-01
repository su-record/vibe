# Feature: design-integration — Phase 3: Context & Workflow

**SPEC**: `.claude/vibe/specs/design-integration/phase-3-context-workflow.md`
**Master Feature**: `.claude/vibe/features/design-integration/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** 프로젝트별 디자인 컨텍스트가 저장되고 모든 design-* 스킬에서 자동 참조
**So that** 매번 디자인 방향을 반복 설명하지 않고 일관된 디자인 가이드를 받을 수 있다

## Scenarios

### Scenario 1: design-context.json 생성
```gherkin
Scenario: Create design context via /design-teach
  Given 프로젝트에 .claude/vibe/design-context.json이 없다
  When 사용자가 /design-teach를 실행한다
  And 코드베이스에서 기존 디자인 정보(CSS, Tailwind config, UI 라이브러리)가 자동 탐색된다
  And 사용자가 대상 사용자, 브랜드 성격, 미학 방향을 답변한다
  Then .claude/vibe/design-context.json이 스키마 v1에 맞게 생성된다
  And audience, brand, aesthetic, constraints 섹션이 모두 포함된다
```
**Verification**: SPEC AC #1

### Scenario 2: design-* 스킬에서 context 자동 참조
```gherkin
Scenario: design-audit reads design context
  Given .claude/vibe/design-context.json이 존재한다
  And brand.personality에 ["professional", "trustworthy"]가 설정되어 있다
  When 사용자가 /design-audit를 실행한다
  Then context의 brand personality가 감사 기준에 반영된다
  And "playful" 스타일의 요소가 불일치로 플래그된다
```
**Verification**: SPEC AC #3

### Scenario 3: context 없을 때 안내
```gherkin
Scenario: design-audit without context shows guidance
  Given .claude/vibe/design-context.json이 없다
  When 사용자가 /design-audit를 실행한다
  Then "Run /design-teach first for better results" 안내가 표시된다
  And context 없이도 기본 감사는 수행된다
```
**Verification**: SPEC AC #4, #5

### Scenario 4: Skill 간 연결 가이드
```gherkin
Scenario: design-audit suggests next skill
  Given /design-audit 결과에 디자인 시스템 불일치가 다수 발견되었다
  When 리포트가 출력된다
  Then "Next: /design-normalize (디자인 시스템 정렬)" 추천이 포함된다
```
**Verification**: SPEC AC #5

### Scenario 5: CLAUDE.md에 디자인 스킬 추천 포함
```gherkin
Scenario: Proactive design skill suggestions in CLAUDE.md
  Given CLAUDE.md의 Proactive Skill Suggestions 테이블이 업데이트되었다
  When 사용자가 "new page", "dashboard" 등 UI 관련 키워드를 사용한다
  Then /design-teach가 추천된다
  When UI 컴포넌트 구현 후
  Then /design-audit가 추천된다
  When 배포 직전
  Then /design-polish가 추천된다
```
**Verification**: SPEC AC #6

### Scenario 6: SPEC 워크플로우에 디자인 단계 포함
```gherkin
Scenario: Design phases in SPEC workflow
  Given vibe.spec 워크플로우 문서가 업데이트되었다
  When SPEC Phase를 확인한다
  Then design-context.json 확인 단계가 포함되어 있다
  When REVIEW Phase를 확인한다
  Then /design-audit, /design-critique 단계가 포함되어 있다
  When PRE-SHIP Phase를 확인한다
  Then /design-normalize, /design-polish 단계가 포함되어 있다
```
**Verification**: SPEC AC #7

### Scenario 7: design-teach 재실행 시 기존 값 보존
```gherkin
Scenario: Re-run design-teach with existing context
  Given .claude/vibe/design-context.json이 이미 존재한다
  And createdAt이 "2026-03-01T00:00:00Z"이다
  When 사용자가 /design-teach를 다시 실행한다
  Then 각 질문에 기존 값이 기본값으로 표시된다
  And 사용자가 "keep" 응답 시 해당 필드가 유지된다
  And createdAt은 "2026-03-01T00:00:00Z"으로 보존된다
  And updatedAt만 현재 시각으로 갱신된다
```
**Verification**: Phase 3 constraint - rerun semantics

### Scenario 8: design-normalize에서 MASTER.md 없을 때
```gherkin
Scenario: design-normalize without MASTER.md
  Given 프로젝트에 MASTER.md가 없다
  When 사용자가 /design-normalize를 실행한다
  Then "Run /design-teach or create MASTER.md first" 안내가 표시된다
  And 기본 토큰(CSS custom properties 표준값)으로 감사는 수행된다
```
**Verification**: Phase 1 constraint - MASTER.md missing handling

### Scenario 8: corrupt design-context.json 처리
```gherkin
Scenario: design-audit with corrupt context file
  Given .claude/vibe/design-context.json이 잘못된 JSON이다
  When 사용자가 /design-audit를 실행한다
  Then "design-context.json 파싱 실패" 경고가 표시된다
  And 기본값으로 감사가 수행된다
  And context 파일 재생성을 위해 /design-teach 안내가 표시된다
```
**Verification**: Phase 3 constraint - JSON parse failure handling

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (context schema in design-teach) | ✅ |
| 2 | AC-3 (design-* skill reads context) | ✅ |
| 3 | AC-4, AC-5 (missing context guidance + next steps) | ✅ |
| 4 | AC-5 (skill chaining) | ✅ |
| 5 | AC-6 (CLAUDE.md suggestions) | ✅ |
| 6 | AC-7 (SPEC workflow) | ✅ |
| 7 | Rerun (design-teach rerun semantics) | ✅ |
| 8 | Error (MASTER.md missing for normalize) | ✅ |
| 9 | Error (corrupt design-context.json) | ✅ |

**Last verified**: 2026-03-31
**Quality score**: 95/100
