---
status: completed
currentPhase: 3
totalPhases: 3
createdAt: 2026-02-07T19:39:22+09:00
lastUpdated: 2026-02-07T19:39:22+09:00
---

# SPEC: runtime-module-exports

## Persona
<role>
@su-record/core 패키지의 시니어 아키텍트. 모듈러 패키지 설계, TypeScript package.json exports, barrel file 패턴에 전문성을 가짐. 기존 코드 패턴을 존중하면서 최소한의 변경으로 모듈화를 달성.
</role>

## Context
<context>
### Background
@su-record/core는 SPEC-driven AI 코딩 프레임워크로, 텔레그램 봇, 브라우저 자동화, 멀티 LLM 오케스트레이션, 메모리/RAG, 보안 정책 등 다양한 런타임 인프라를 포함하고 있다.

현재 문제:
1. **모놀리식 export 구조**: `package.json`의 `exports` 필드가 `./tools`, `./orchestrator`, `./lib/*`만 노출
2. **런타임 인프라 미노출**: interface, router, memory(lib), policy 모듈이 export 경로 없음
3. **God File**: `telegram-assistant-bridge.ts`가 19개 import를 하드코딩하여 모듈 분리 없이 직접 조립
4. **router/index.ts 부재**: router 모듈의 barrel file이 없어 개별 파일 직접 import 필요

목표: 앱이 필요한 인프라만 선택적으로 import할 수 있도록 모듈화

```typescript
// Before: 19개 하드코딩 import
import { TelegramBot } from '../interface/telegram/TelegramBot.js';
import { ModelARouter } from '../router/ModelARouter.js';
// ... 17 more

// After: 모듈별 선택적 import
import { TelegramBot } from '@su-record/core/interface';
import { ModelARouter, BaseRoute, RouteRegistry } from '@su-record/core/router';
import { SmartRouter } from '@su-record/core/orchestrator';
import { MemoryStorage, SessionRAGStore } from '@su-record/core/memory';
import { PolicyEngine } from '@su-record/core/policy';
```

### Tech Stack
- Runtime: Node.js 18+, TypeScript 5.5+
- Module: ESM (`"type": "module"`)
- Build: tsc (TypeScript compiler)
- DB: SQLite (better-sqlite3)
- Test: Vitest 4.x

### Related Code

**현재 export 구조 (package.json):**
```json
"exports": {
  ".": "./dist/cli/index.js",
  "./tools": "./dist/tools/index.js",
  "./tools/memory": "./dist/tools/memory/index.js",
  "./tools/convention": "./dist/tools/convention/index.js",
  "./tools/semantic": "./dist/tools/semantic/index.js",
  "./tools/ui": "./dist/tools/ui/index.js",
  "./tools/time": "./dist/tools/time/index.js",
  "./tools/interaction": "./dist/tools/interaction/index.js",
  "./orchestrator": "./dist/orchestrator/index.js",
  "./lib/gpt": "./dist/lib/gpt-api.js",
  "./lib/gemini": "./dist/lib/gemini-api.js",
  "./lib/kimi": "./dist/lib/kimi-api.js"
}
```

**이미 barrel file이 있는 모듈:**
- `src/interface/index.ts` — BaseInterface, TelegramBot, WebServer, WebhookHandler, types
- `src/policy/index.ts` — PolicyEngine, PolicyStore, RiskCalculator, EvidenceStore, types
- `src/orchestrator/index.ts` — SmartRouter, LLMCluster, AgentRegistry, PhasePipeline 등
- `src/lib/memory/index.ts` — MemoryStorage, KnowledgeGraph, MemorySearch, ObservationStore

**barrel file이 없는 모듈:**
- `src/router/` — index.ts 없음. 인프라(ModelARouter, IntentClassifier, RouteRegistry, BaseRoute, types)와 애플리케이션(7개 Route, 18개 Service)이 혼재

### Research Findings

**GPT/Gemini/Kimi 합의사항:**
- 명시적 subpath exports 사용 (와일드카드 `'./*'` 금지)
- `types` 조건을 exports에 첫 번째로 배치
- `sideEffects: false` 설정으로 tree-shaking 지원
- `publint`, `arethetypeswrong` 도구로 export 검증
- barrel file은 얕고 목적에 맞게 유지, 대규모 re-export 금지
- `export type {}` 으로 타입과 값 export 분리 (verbatimModuleSyntax 호환)
- 내부 모듈은 exports map에서 제외하여 deep import 방지

**보안 고려사항 (GPT 합의):**
- 최소 export 원칙: 의도된 진입점만 노출
- `files` 필드로 publish 대상 제한 (이미 적용됨)
- 내부 타입 재노출 방지
- `npm pack`으로 배포 아티팩트 검증

**아키텍처 패턴 (Kimi 합의):**
- 인프라/애플리케이션 경계를 명확히 분리
- 단방향 의존성: core → shared, feature → core (역방향 금지)
- dynamic import으로 무거운 의존성(playwright, better-sqlite3) 지연 로딩
- TypeScript project references로 모듈 간 타입 체킹 격리 (향후 고려)

### 모듈 경계 정의

| 계층 | 모듈 | Export 경로 | 내용 |
|------|------|------------|------|
| 런타임 인프라 | interface | `./interface` | TelegramBot, WebServer, BaseInterface, types |
| 런타임 인프라 | router | `./router` | ModelARouter, BaseRoute, IntentClassifier, RouteRegistry, types |
| 런타임 인프라 | orchestrator | `./orchestrator` | SmartRouter, LLMCluster (이미 존재) |
| 런타임 인프라 | memory | `./memory` | MemoryStorage, KnowledgeGraph, SessionRAG, MemoryManager |
| 런타임 인프라 | policy | `./policy` | PolicyEngine, RiskCalculator, EvidenceStore, types |
| 개발 도구 | tools | `./tools` | SPEC, Review, Quality (이미 존재) |
| 애플리케이션 참조 | (없음) | export 안함 | routes/*, services/*, bridge — 프로젝트가 복사하여 커스터마이징 |
</context>

## Task
<task>
### Phase 1: Router Barrel File 생성
1. [ ] `src/router/index.ts` 생성 — 인프라 코어만 export
   - File: `src/router/index.ts`
   - Export 대상 (인프라):
     - `ModelARouter` from `./ModelARouter.js`
     - `IntentClassifier` from `./IntentClassifier.js`
     - `RouteRegistry` from `./RouteRegistry.js`
     - `BaseRoute` from `./routes/BaseRoute.js`
     - `TaskPlanner` from `./planner/TaskPlanner.js`
     - `TaskExecutor` from `./planner/TaskExecutor.js`
     - `BrowserManager` from `./browser/BrowserManager.js`
     - `BrowserAgent` from `./browser/BrowserAgent.js`
     - `BrowserPool` from `./browser/BrowserPool.js`
     - `DevSessionManager` from `./sessions/DevSessionManager.js`
     - `RepoResolver` from `./resolvers/RepoResolver.js`
     - `NotificationManager` from `./notifications/NotificationManager.js`
     - `GitOpsHandler` from `./handlers/GitOpsHandler.js`
     - `TelegramQABridge` from `./qa/TelegramQABridge.js`
     - 타입 (type-only export):
       - `IntentCategory`, `ClassifiedIntent` (Intent 분류)
       - `RouteContext`, `RouteResult`, `RouteJob`, `RouteJobStatus` (Route 타입)
       - `RouterConfig`, `RepoConfig`, `QAConfig`, `NotificationConfig` (설정)
       - `RouteServices`, `TelegramSendOptions`, `InlineKeyboardButton` (서비스 의존성)
       - `ModelARouterInterface`, `SmartRouterLike` (인터페이스)
       - `DedupEntry` (캐시)
       - `DEFAULT_ROUTER_CONFIG` (기본값 — 값 export)
   - Export 제외 (애플리케이션 코드 — 명시적 경로):
     - Route 구현 (5개): `routes/DevRoute.ts`, `routes/GoogleRoute.ts`, `routes/BrowseRoute.ts`, `routes/MonitorRoute.ts`, `routes/ResearchRoute.ts`, `routes/UtilityRoute.ts`, `routes/CompositeRoute.ts`
     - Service 구현 (18개): `services/BookmarkService.ts`, `services/CalendarService.ts`, `services/ContentSummarizer.ts`, `services/DailyReportGenerator.ts`, `services/DocumentGenerator.ts`, `services/DriveService.ts`, `services/FileAnalyzer.ts`, `services/GitHubMonitor.ts`, `services/GmailService.ts`, `services/GoogleAuthManager.ts`, `services/ImageGenerator.ts`, `services/NoteService.ts`, `services/SchedulerEngine.ts`, `services/ScreenshotService.ts`, `services/SheetsService.ts`, `services/TranslationService.ts`, `services/WebSearchService.ts`, `services/YouTubeService.ts`
     - 판별 규칙: `routes/*Route.ts` 및 `services/*.ts` 패턴은 애플리케이션 코드로 간주하여 barrel에서 제외
   - Verify: `npx tsc --noEmit`
   - Router barrel file 총 export 수: 인프라 클래스 14개 + 타입 16개 + 값 1개(DEFAULT_ROUTER_CONFIG) = 31개
   - 순환 의존성 방지: barrel file이 import하는 모듈이 barrel file을 역참조하지 않도록 확인

### Phase 2: Package.json Exports 추가
1. [ ] `package.json`의 `exports` 필드에 4개 런타임 모듈 추가
   - File: `package.json`
   - **참고**: `./interface`와 `./policy`는 이미 barrel file 존재 (`src/interface/index.ts`, `src/policy/index.ts`). 새 barrel 생성 불필요, package.json exports 추가만 필요
   - 추가할 exports (types 조건을 첫 번째로 배치):
     ```json
     "./interface": {
       "types": "./dist/interface/index.d.ts",
       "default": "./dist/interface/index.js"
     },
     "./router": {
       "types": "./dist/router/index.d.ts",
       "default": "./dist/router/index.js"
     },
     "./memory": {
       "types": "./dist/lib/memory/index.d.ts",
       "default": "./dist/lib/memory/index.js"
     },
     "./policy": {
       "types": "./dist/policy/index.d.ts",
       "default": "./dist/policy/index.js"
     }
     ```
   - 기존 exports는 그대로 유지 (하위 호환성). 기존 형식이 단순 string이면 해당 형식 유지
   - 기존 `./lib/*` 경로와 새 `./memory` 경로는 독립적 (중복 아님)
   - Verify: `npm run build && node -e "import('@su-record/core/router')"`

2. [ ] Memory 모듈 barrel file 보강
   - File: `src/lib/memory/index.ts`
   - 추가 export (클래스):
     - `SessionRAGStore` from `./SessionRAGStore.js`
     - `SessionRAGRetriever` from `./SessionRAGRetriever.js`
     - `SessionSummarizer` from `./SessionSummarizer.js`
   - 추가 export (타입, type-only):
     - `Decision`, `DecisionInput`, `DecisionStatus` from `./SessionRAGStore.js`
     - `Constraint`, `ConstraintInput`, `ConstraintType`, `ConstraintSeverity` from `./SessionRAGStore.js`
     - `Goal`, `GoalInput`, `GoalStatus` from `./SessionRAGStore.js`
     - `Evidence`, `EvidenceInput`, `EvidenceType`, `EvidenceStatus` from `./SessionRAGStore.js`
     - `SessionRAGStats` from `./SessionRAGStore.js`
     - `RetrievalOptions`, `SessionRAGResult` from `./SessionRAGRetriever.js`
     - `SessionSummary` from `./SessionSummarizer.js`
   - MemoryManager facade: `src/lib/MemoryManager.ts`에 위치 (`../MemoryManager.js` 경로)
     - 순환 참조 검증: `npx madge --circular --extensions ts src/lib/memory/index.ts` 실행
     - exit code 0 → MemoryManager re-export 포함
     - 순환 감지 → MemoryManager barrel에서 제외 (소비자는 직접 import 유지)
   - Verify: `npx tsc --noEmit`

### Phase 3: 빌드 검증 및 Export 테스트
1. [ ] TypeScript 빌드 검증
   - Command: `npm run build`
   - 모든 새 barrel file의 `.d.ts` 생성 확인
   - 빌드 실패 시: 에러 메시지 기반으로 barrel file의 import 경로 수정 (존재하지 않는 모듈 참조, 순환 의존성 등)

2. [ ] 순환 의존성 검증
   - Tool: `npx madge --circular --extensions ts src/router/index.ts src/lib/memory/index.ts`
   - 성공 기준: exit code 0 (순환 없음)
   - `npx tsc --noEmit` 통과 확인
   - barrel file → 모듈 → barrel file 역참조 패턴 없음 확인
   - 순환 발생 시: 해당 export를 barrel에서 제거하고 직접 import 경로 유지

3. [ ] Export 경로 동작 테스트 작성
   - File: `src/router/index.test.ts`
   - 테스트: router barrel file에서 모든 인프라 클래스 import 가능 확인 (14개 클래스)
   - 테스트: 타입 export가 정상 동작하는지 확인 (15개 타입 + DEFAULT_ROUTER_CONFIG)
   - File: `src/lib/memory/index.test.ts` (기존 파일 보강)
   - 테스트: memory barrel file에서 SessionRAGStore, SessionRAGRetriever, SessionSummarizer import 확인
   - 테스트: SessionRAG 관련 타입(Decision, Constraint, Goal, Evidence 등) import 확인

4. [ ] Export map 무결성 검증
   - 각 export 경로에서 실제 import 가능한지 테스트
   - 내부 모듈(routes/*, services/*)이 직접 import 불가능한지 확인
   - 빌드 후 `dist/` 디렉토리에 해당 `.d.ts` 파일 존재 확인
   - Command: `npm run test`
</task>

## Constraints
<constraints>
- **하위 호환성 필수**: 기존 `./tools`, `./orchestrator`, `./lib/*` import 경로는 그대로 유지
- **인프라/애플리케이션 분리**: router barrel file은 인프라만 export, 라우트 구현(DevRoute, GoogleRoute 등)과 서비스(GmailService 등)는 제외
- **type-only export**: 타입은 `export type {}` 구문 사용 (verbatimModuleSyntax 호환)
- **ESM 전용**: 현재 패키지가 `"type": "module"`이므로 CJS 지원 불필요
- **기존 코드 수정 최소화**: 새 barrel file 생성 + package.json export 추가만. 기존 파일의 import 경로 변경 없음
- **sideEffects 설정 없음**: 현재 패키지에 `sideEffects` 필드가 없으므로 이번 스코프에서 추가하지 않음 (별도 이슈)
- **`any` 타입 금지**: TypeScript strict mode 준수
- **함수 길이 50줄 이내**: barrel file이므로 해당 없지만 테스트 코드도 준수
- **순환 의존성 금지**: barrel file이 export하는 모듈이 barrel file을 역참조해서는 안됨
- **빌드 시간 영향 최소화**: barrel file 추가로 인한 tsc 빌드 시간 증가는 유의미하지 않아야 함 (barrel file은 re-export만 수행)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/index.ts` — Router 모듈 barrel file (인프라 export)

### Files to Modify
- `package.json` — exports 필드에 4개 모듈 경로 추가
- `src/lib/memory/index.ts` — SessionRAG, SessionSummarizer, MemoryManager 추가 export

### Test Files to Create
- `src/router/index.test.ts` — Router barrel file import 검증

### Verification Commands
- `npx tsc --noEmit` — 타입 체크
- `npm run build` — 빌드
- `npm run test` — 테스트
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `import { ModelARouter, BaseRoute, IntentClassifier, RouteRegistry } from '@su-record/core/router'` 동작
- [ ] `import { TelegramBot, WebServer, BaseInterface } from '@su-record/core/interface'` 동작
- [ ] `import { MemoryStorage, KnowledgeGraph, SessionRAGStore } from '@su-record/core/memory'` 동작
- [ ] `import { PolicyEngine, RiskCalculator, EvidenceStore } from '@su-record/core/policy'` 동작
- [ ] 기존 `import { SmartRouter } from '@su-record/core/orchestrator'` 여전히 동작
- [ ] 기존 `import { ... } from '@su-record/core/tools'` 여전히 동작
- [ ] router barrel file에 DevRoute, GoogleRoute 등 애플리케이션 코드 미포함
- [ ] router barrel file에 services/* 미포함
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 성공
- [ ] `npm run test` 통과
- [ ] memory barrel file에 SessionRAGStore, SessionRAGRetriever, SessionSummarizer 포함
- [ ] `npx madge --circular --extensions ts src/router/index.ts src/lib/memory/index.ts` exit code 0
</acceptance>
