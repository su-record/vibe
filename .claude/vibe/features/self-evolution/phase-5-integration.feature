# Feature: self-evolution — Phase 5: Integration & Hook

**SPEC**: `.claude/vibe/specs/self-evolution/phase-5-integration.md`
**Master Feature**: `.claude/vibe/features/self-evolution/_index.feature`

## User Story (Phase Scope)
**As a** vibe 사용자
**I want** self-evolution이 기존 시스템에 seamless하게 통합되길
**So that** 별도 설정 없이 자동으로 작동하고, 필요 시 CLI로 관리 가능함

## Scenarios

### Scenario 1: Evolution Hook 작동
```gherkin
Scenario: PostToolUse에서 evolution-engine.js 실행
  Given evolution.enabled=true 설정이고
  And 세션 내 5번째 tool use가 발생하면
  When evolution-engine.js가 트리거되면
  Then InsightExtractor.extractFromRecent()가 호출되고
  And 50ms 이내에 완료됨
```
**Verification**: SPEC AC #1

### Scenario 2: Prompt Dispatcher Gap Detection
```gherkin
Scenario: 매칭 실패 시 gap 로깅
  Given evolution.gapDetection=true 설정이고
  When 사용자 프롬프트 "PDF 분석해줘"가 어떤 skill과도 매칭되지 않으면
  Then SkillGapDetector.logMiss()가 호출되고
  And prompt, timestamp가 DB에 기록됨
```
**Verification**: SPEC AC #2

### Scenario 3: Skill Injector auto/ 디렉토리 스캔
```gherkin
Scenario: auto/ 디렉토리의 skill도 매칭 대상에 포함
  Given ~/.claude/vibe/skills/auto/auto-csv-analyzer.md가 존재하고
  And status가 active이고
  When 사용자가 "CSV 분석" 관련 프롬프트를 입력하면
  Then auto-csv-analyzer.md가 매칭 후보에 포함되고
  And UsageTracker에 사용이 기록됨
```
**Verification**: SPEC AC #3

### Scenario 4: CLI Status 명령어
```gherkin
Scenario: vibe evolution status가 전체 현황 표시
  Given 생성물이 존재하고
  When `vibe evolution status` 명령어를 실행하면
  Then active/testing/draft/disabled 개수가 표시되고
  And 최근 insights 요약이 포함됨
```
**Verification**: SPEC AC #4

### Scenario 5: CLI Approve/Reject 명령어
```gherkin
Scenario: vibe evolution approve로 draft 승인
  Given draft 상태인 generation id="gen-001"이 존재하고
  When `vibe evolution approve gen-001`을 실행하면
  Then status가 'testing'으로 변경되고
  And skill-injector에서 활성화됨
```
**Verification**: SPEC AC #5

### Scenario 6: Config로 전체 비활성화
```gherkin
Scenario: evolution.enabled=false 시 모든 기능 비활성화
  Given config.json에 evolution.enabled=false 설정이고
  When 세션이 시작되면
  Then evolution-engine.js hook이 실행되지 않고
  And prompt-dispatcher gap detection이 비활성화되고
  And skill-injector의 auto/ 스캔이 비활성화됨
```
**Verification**: SPEC AC #6

### Scenario 7: Ultrawork 모드에서 auto override
```gherkin
Scenario: ultrawork 키워드 감지 시 auto 모드
  Given config.json에 evolution.mode="suggest"이고
  When ultrawork 키워드가 감지되면
  Then evolution.mode가 "auto"로 runtime override되고
  And 생성된 skill이 자동 활성화됨
```
**Verification**: SPEC AC #7

### Scenario 8: 세션 시작 시 Evolution Status 표시
```gherkin
Scenario: 세션 시작 시 evolution 현황 요약
  Given 3개 active skill, 2개 pending approval, 1개 gap이 감지되었고
  When 새 세션이 시작되면
  Then "🧬 Evolution: 3 active skills, 2 pending approval, 1 gap detected" 형태로 표시됨
```
**Verification**: SPEC AC #8

### Scenario 9: CLI disable-all 긴급 비활성화
```gherkin
Scenario: vibe evolution disable-all 실행
  Given 여러 active auto-generated 파일이 존재하고
  When `vibe evolution disable-all`을 실행하면
  Then RollbackManager.emergencyDisableAll()이 호출되고
  And 모든 파일이 .disabled로 변경됨
```
**Verification**: SPEC AC #5 (CLI 경로)

### Scenario 10: Module Export 구조
```gherkin
Scenario: evolution 모듈이 올바르게 export됨
  Given src/lib/evolution/index.ts가 존재하고
  When `import { ReflectionStore, InsightExtractor } from '@su-record/core/evolution'`
  Then 모든 Phase 1-4 클래스가 정상 import됨
```
**Verification**: SPEC AC #9 (빌드 성공)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (evolution hook) | ✅ |
| 2 | AC-2 (gap detection) | ✅ |
| 3 | AC-3 (skill-injector auto/) | ✅ |
| 4 | AC-4 (CLI status) | ✅ |
| 5 | AC-5 (CLI approve/reject) | ✅ |
| 6 | AC-6 (config disable) | ✅ |
| 7 | AC-7 (ultrawork auto override) | ✅ |
| 8 | AC-8 (session start status) | ✅ |
| 9 | AC-5 (CLI disable-all) | ✅ |
| 10 | AC-9 (module export) | ✅ |
