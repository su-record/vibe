# Feature: openclaw-integration — Phase 5: Skill System Enhancement

**SPEC**: `.claude/core/specs/openclaw-integration/phase-5-skills.md`
**Master Feature**: `.claude/core/features/openclaw-integration/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 사용자
**I want** 스킬의 3계층 로딩(Progressive Disclosure)과 의존성 자동 확인
**So that** 컨텍스트를 효율적으로 사용하고, 누락된 도구가 있을 때 안내를 받을 수 있다

## Scenarios

### Scenario 1: Metadata-Only Loading Performance
```gherkin
Scenario: 50개 스킬 metadata 파싱 성능
  Given 50개 스킬 파일이 존재
  When 세션 시작 시 전체 스킬 metadata를 로드하면
  Then 100ms 이내에 완료된다
  And 각 스킬의 name, description, triggers가 캐시된다
```
**Verification**: SPEC AC #1

### Scenario 2: Non-Triggered Skills Show Name Only
```gherkin
Scenario: 트리거 매칭되지 않은 스킬은 이름만 표시
  Given "deploy docker" 프롬프트를 입력
  And "weather" 스킬이 트리거 매칭되지 않음
  When skill-injector가 실행되면
  Then "weather" 스킬은 Available Skills 섹션에 이름+설명만 표시된다
  And body는 포함되지 않는다
```
**Verification**: SPEC AC #2

### Scenario 3: Triggered Skills Include Full Body
```gherkin
Scenario: 트리거 매칭된 스킬은 전체 body 포함
  Given "commit push PR" 프롬프트를 입력
  And "commit-push-pr" 스킬의 trigger가 ["commit", "push", "PR"]
  When skill-injector가 실행되면
  Then Triggered Skills 섹션에 전체 body가 포함된다
```
**Verification**: SPEC AC #3

### Scenario 4: Body Truncation with maxBodyTokens
```gherkin
Scenario: maxBodyTokens 설정 시 body 절삭
  Given 스킬에 maxBodyTokens: 1000 설정
  And 스킬 body가 10000자
  When 트리거 매칭되어 body를 로드하면
  Then body가 약 4000자(1000 tokens × 4 chars)로 절삭된다
```
**Verification**: SPEC AC #4

### Scenario 5: Resource Directory Detection
```gherkin
Scenario: scripts/references 디렉토리 존재 알림
  Given 스킬 디렉토리에 scripts/helper.py와 references/api.md가 있음
  When 해당 스킬이 트리거 매칭되면
  Then "Resources available: scripts/helper.py, references/api.md" 알림이 포함된다
```
**Verification**: SPEC AC #5

### Scenario 6: Missing Binary Skip
```gherkin
Scenario: 필요 바이너리 없으면 스킬 skip
  Given 스킬에 requires: ["docker"] 설정
  And docker가 설치되어 있지 않음
  When 해당 스킬이 트리거 매칭되면
  Then 스킬이 skip되고
  And "Skill skipped: Missing docker. Install: brew install docker" 안내가 포함된다
```
**Verification**: SPEC AC #6

### Scenario 7: Platform Restriction
```gherkin
Scenario: 플랫폼 제한으로 스킬 skip
  Given 스킬에 os: ["darwin"] 설정
  And 현재 플랫폼이 linux
  When 해당 스킬이 트리거 매칭되면
  Then 스킬이 skip된다
```
**Verification**: SPEC AC #7

### Scenario 8: Backward Compatibility
```gherkin
Scenario: 새 필드 없는 기존 스킬 정상 동작
  Given 기존 스킬 파일에 requires, os, maxBodyTokens 필드가 없음
  When 해당 스킬이 트리거 매칭되면
  Then 기존과 동일하게 전체 body가 주입된다
  And 에러 없이 정상 동작한다
```
**Verification**: SPEC AC #8

### Scenario 9: Binary Check Caching
```gherkin
Scenario: 바이너리 확인 결과 5분 캐싱
  Given 첫 번째 프롬프트에서 docker 존재 확인 완료
  When 2분 후 두 번째 프롬프트가 입력되면
  Then docker 확인을 다시 실행하지 않고 캐시를 사용한다
  And 5분 후에는 캐시가 만료되어 재확인한다
```
**Verification**: SPEC AC #9

### Scenario 10: Install Hint for Skipped Skills
```gherkin
Scenario: skip된 스킬에 설치 안내 포함
  Given 스킬에 requires: ["kubectl"], install: { brew: "kubernetes-cli" } 설정
  And kubectl이 설치되어 있지 않음
  When 해당 스킬이 skip되면
  Then HTML 주석으로 "Install: brew install kubernetes-cli" 안내가 포함된다
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-5 | ✅ |
| 6 | AC-6 | ✅ |
| 7 | AC-7 | ✅ |
| 8 | AC-8 | ✅ |
| 9 | AC-9 | ✅ |
| 10 | AC-10 | ✅ |
