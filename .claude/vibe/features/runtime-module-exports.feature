# Feature: runtime-module-exports

**SPEC**: `.claude/vibe/specs/runtime-module-exports.md`

## User Story
**As a** @su-record/core 기반 애플리케이션 개발자
**I want** 런타임 인프라 모듈을 개별 경로로 선택적 import
**So that** 필요한 기능만 가져와 애플리케이션을 구성할 수 있다

## Scenarios

### Scenario 1: Router 모듈 선택적 import
```gherkin
Scenario: 앱 개발자가 router 인프라만 import한다
  Given @su-record/core 패키지가 설치되어 있다
  When `import { ModelARouter, BaseRoute, IntentClassifier, RouteRegistry } from '@su-record/core/router'` 를 실행한다
  Then 모든 클래스가 정상적으로 import된다
  And TypeScript 타입 추론이 정상 동작한다
```
**Verification**: SPEC AC #1

### Scenario 2: Interface 모듈 선택적 import
```gherkin
Scenario: 앱 개발자가 interface 인프라만 import한다
  Given @su-record/core 패키지가 설치되어 있다
  When `import { TelegramBot, WebServer, BaseInterface } from '@su-record/core/interface'` 를 실행한다
  Then 모든 클래스가 정상적으로 import된다
  And 관련 타입(TelegramConfig, WebServerConfig 등)도 import 가능하다
```
**Verification**: SPEC AC #2

### Scenario 3: Memory 모듈 선택적 import
```gherkin
Scenario: 앱 개발자가 memory/RAG 인프라만 import한다
  Given @su-record/core 패키지가 설치되어 있다
  When `import { MemoryStorage, KnowledgeGraph, SessionRAGStore } from '@su-record/core/memory'` 를 실행한다
  Then 모든 클래스가 정상적으로 import된다
  And SessionRAGRetriever, SessionSummarizer, MemoryManager도 import 가능하다
```
**Verification**: SPEC AC #3

### Scenario 4: Policy 모듈 선택적 import
```gherkin
Scenario: 앱 개발자가 policy 인프라만 import한다
  Given @su-record/core 패키지가 설치되어 있다
  When `import { PolicyEngine, RiskCalculator, EvidenceStore } from '@su-record/core/policy'` 를 실행한다
  Then 모든 클래스가 정상적으로 import된다
  And 관련 타입(Policy, PolicyRule, RiskLevel 등)도 import 가능하다
```
**Verification**: SPEC AC #4

### Scenario 5: 기존 import 경로 하위 호환성
```gherkin
Scenario: 기존 import 경로가 계속 동작한다
  Given @su-record/core 패키지가 업데이트되었다
  When 기존 코드에서 다음 import를 실행한다:
    | import 경로 |
    | @su-record/core/orchestrator |
    | @su-record/core/tools |
    | @su-record/core/tools/memory |
    | @su-record/core/lib/gpt |
    | @su-record/core/lib/gemini |
    | @su-record/core/lib/kimi |
  Then 모든 import가 정상적으로 동작한다
  And 기존 동작에 변화가 없다
```
**Verification**: SPEC AC #5, #6

### Scenario 6: 애플리케이션 코드 미노출
```gherkin
Scenario: router barrel file에 애플리케이션 코드가 포함되지 않는다
  Given src/router/index.ts barrel file이 생성되었다
  When barrel file의 export 목록을 확인한다
  Then DevRoute, GoogleRoute, BrowseRoute 등 Route 구현이 없다
  And GmailService, NoteService 등 Service 구현이 없다
  And 인프라 코어(ModelARouter, BaseRoute, IntentClassifier, RouteRegistry)만 있다
```
**Verification**: SPEC AC #7, #8

### Scenario 7: 빌드 및 테스트 통과
```gherkin
Scenario: 모든 변경 후 빌드와 테스트가 통과한다
  Given 모든 Phase의 변경이 완료되었다
  When `npm run build` 를 실행한다
  Then 빌드가 성공한다
  And 새 barrel file의 .d.ts가 생성된다
  When `npm run test` 를 실행한다
  Then 모든 테스트가 통과한다
```
**Verification**: SPEC AC #9, #10, #11

### Scenario 8: Memory barrel file 보강
```gherkin
Scenario: memory barrel file에 SessionRAG 관련 클래스가 포함된다
  Given src/lib/memory/index.ts가 수정되었다
  When barrel file의 export 목록을 확인한다
  Then SessionRAGStore가 export되어 있다
  And SessionRAGRetriever가 export되어 있다
  And SessionSummarizer가 export되어 있다
  And Decision, DecisionInput, DecisionStatus 타입이 export되어 있다
  And Constraint, ConstraintInput, ConstraintType, ConstraintSeverity 타입이 export되어 있다
  And Goal, GoalInput, GoalStatus 타입이 export되어 있다
  And Evidence, EvidenceInput, EvidenceType, EvidenceStatus 타입이 export되어 있다
  And SessionRAGStats, RetrievalOptions, SessionRAGResult 타입이 export되어 있다
  And SessionSummary 타입이 export되어 있다
```
**Verification**: SPEC AC #12

### Scenario 9: 순환 의존성 없음
```gherkin
Scenario: barrel file이 순환 의존성을 발생시키지 않는다
  Given src/router/index.ts barrel file이 생성되었다
  And src/lib/memory/index.ts가 수정되었다
  When `npx tsc --noEmit`을 실행한다
  Then 순환 의존성 에러 없이 타입 체크가 통과한다
  And barrel file이 import하는 모듈이 barrel file을 역참조하지 않는다
```
**Verification**: SPEC Constraint - 순환 의존성 금지

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (router import) | ✅ |
| 2 | AC-2 (interface import) | ✅ |
| 3 | AC-3 (memory import) | ✅ |
| 4 | AC-4 (policy import) | ✅ |
| 5 | AC-5, AC-6 (backward compat) | ✅ |
| 6 | AC-7, AC-8 (no app code) | ✅ |
| 7 | AC-9, AC-10, AC-11 (build/test) | ✅ |
| 8 | AC-12 (memory barrel) | ✅ |
| 9 | Constraint (circular deps) | ✅ |

**Last verified**: 2026-02-07 21:27
**Quality score**: 97/100
