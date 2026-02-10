---
status: pending
currentPhase: 1
totalPhases: 4
createdAt: 2026-02-07T09:39:00+09:00
lastUpdated: 2026-02-07T09:39:00+09:00
---

# SPEC: telegram-model-a / Phase 1 - 코어 라우터 + 개발 라우트

## Persona
<role>
TypeScript/Node.js 시니어 개발자. 기존 VIBE 프레임워크의 아키텍처 패턴(EventEmitter, 상태 머신, 재시도 로직)에 정통하며, 텔레그램 봇 시스템과 Claude Code CLI 통합에 전문성을 가진다. 기존 코드의 컨벤션(logger, 타입 정의, 에러 처리)을 정확히 따른다.
</role>

## Context
<context>
### Background
텔레그램을 통해 개인 AI 비서를 운영하는 시스템의 핵심 인프라. 기존 `telegram-bridge.ts`의 단순 CLI 호출 방식을 Model A Router 기반 아키텍처로 교체한다. LLM+키워드 하이브리드 의도 분류로 메시지를 7개 카테고리(development, google, research, utility, monitor, composite, conversation)로 라우팅한다.

### Who
본인 전용 (1인 사용자), 로컬 PC에서 실행

### Tech Stack
- Runtime: Node.js 18+ / TypeScript 5.5+
- Existing: TelegramBot, ClaudeCodeBridge, JobManager, IntentParser, SmartRouter, LLMCluster, PolicyEngine, SessionPool
- Testing: Vitest
- DB: SQLite (better-sqlite3)

### Related Code (기존 모듈 활용)
- `src/interface/telegram/TelegramBot.ts`: 메시지 수신/발신 (onMessage, sendResponse), polling 모드
- `src/interface/ClaudeCodeBridge.ts`: Claude Code stream-json 프로토콜, 세션 resume, permission_request 이벤트
- `src/job/JobManager.ts`: Job 생명주기 (pending→executing→completed), 이벤트 시스템
- `src/job/IntentParser.ts`: 한/영 키워드 기반 의도 분류 (기존 개발 관련)
- `src/orchestrator/SmartRouter.ts`: 태스크별 LLM 라우팅 + fallback chain
- `src/policy/PolicyEngine.ts`: 위험도 평가, 승인 흐름
- `src/daemon/SessionPool.ts`: 프로젝트별 세션 관리 (최대 5개, 유휴 30분 타임아웃)
- `src/interface/BaseInterface.ts`: 인터페이스 추상 클래스
- `src/interface/types.ts`: ExternalMessage, ClaudeStreamMessage, JobStatus 타입
- `src/bridge/telegram-bridge.ts`: 현재 진입점 (교체 대상)

### Design Reference
- 기존 IntentParser의 키워드 매칭 패턴 확장
- 기존 JobManager의 상태 머신 패턴 재사용
- 기존 ClaudeCodeBridge의 stream-json 프로토콜 활용

### Research Insights
- **GPT**: 계층 아키텍처 (transport→routing→domain→infra), 구조화된 로깅(correlation ID), 중앙 에러 바운더리
- **Gemini**: Agentic Intent Routing (LLM Function Calling), 비동기 Job 큐로 무거운 작업 분리
- **Kimi**: Route precedence 검증, LLM hallucinated intent 화이트리스트 검증, confidence threshold + fallback
- **보안**: spawn with args array, 입력 검증, 토큰 노출 방지, 읽기 전용 도구 자동 승인
</context>

## Task
<task>
### Phase 1.1: 타입 정의 및 기반 구조
1. [ ] `src/router/types.ts` 생성
   - IntentCategory 타입: `'development' | 'google' | 'research' | 'utility' | 'monitor' | 'composite' | 'conversation'`
   - ClassifiedIntent 인터페이스: `{ category, confidence, subIntent?, params?, rawQuery }`
   - RouteContext 인터페이스: `{ job, intent, message, chatId, userId, services }`
   - RouteResult 인터페이스: `{ success, data?, error?, followUp? }`
   - RouterConfig 인터페이스: `{ repos, qa, notifications }`
   - Verify: `npx tsc --noEmit`

2. [ ] `src/router/routes/BaseRoute.ts` 생성
   - 추상 클래스: `abstract canHandle(intent): boolean` + `abstract execute(context): Promise<RouteResult>`
   - 에러 처리 래퍼: try-catch + 재시도 3회 (지수 백오프: 1s, 2s, 4s)
   - 타임아웃 지원: 기본 120초, 라우트별 설정 가능
   - `name` 프로퍼티: 라우트 식별자
   - Verify: `npx tsc --noEmit`

3. [ ] `src/router/RouteRegistry.ts` 생성
   - 라우트 등록/해제: `register(route)`, `unregister(name)`
   - 우선순위 정렬: 등록 순서 기반
   - 라우트 조회: `findRoute(intent): BaseRoute | null`
   - 전체 조회: `getRoutes(): BaseRoute[]`
   - Verify: `npx tsc --noEmit`

### Phase 1.2: IntentClassifier (의도 분류기)
4. [ ] `src/router/IntentClassifier.ts` 생성
   - 3단계 분류:
     1. **명시적 명령 매칭**: `/dev`, `/google`, `/search`, `/util`, `/monitor` 등 접두사
     2. **키워드 heuristic**: 기존 IntentParser 패턴 확장 + 라우트별 키워드 맵
        - development: "코딩", "개발", "버그", "수정", "테스트", "커밋", "푸시", "PR", "코드", "리팩토링"
        - google: "메일", "이메일", "드라이브", "스프레드시트", "시트", "캘린더", "일정", "유튜브"
        - research: "검색", "찾아", "조사", "리서치", "요약", "북마크"
        - utility: "이미지", "번역", "메모", "스크린샷", "PDF", "문서"
        - monitor: "스케줄", "매일", "매주", "모니터", "알림", "리포트"
        - composite: 2개 이상 카테고리 키워드 동시 존재
     3. **LLM 분류**: SmartRouter.route({ type: 'reasoning' }) 활용, confidence < 0.7일 때만
   - confidence threshold: 0.7 (미만 시 다음 단계로)
   - 복합 의도 분해: "검색해서 메일로 보내줘" → `[{ research, 0.9 }, { google, 0.9 }]`
   - LLM 응답 화이트리스트 검증: 등록된 카테고리만 허용
   - Verify: unit test 작성 + `npx vitest run src/router/IntentClassifier.test.ts`

### Phase 1.3: ModelA Router (코어 라우터)
5. [ ] `src/router/ModelARouter.ts` 생성
   - 싱글톤 패턴 (앱 라이프사이클과 동일)
   - 초기화: RouteRegistry에 라우트 등록, IntentClassifier 초기화
   - 메시지 처리 파이프라인:
     1. ExternalMessage 수신
     2. 중복 방지 (update_id 기반 dedup, LRU 캐시 1000개, TTL 24시간, 앱 재시작 시 초기화)
     3. IntentClassifier로 의도 분류
     4. RouteRegistry에서 적합한 라우트 찾기
     5. Job 생성 (JobManager 활용)
     6. 라우트 실행
     7. 결과를 텔레그램으로 전송
   - 에러 바운더리: 최상위 에러 → 사용자 친화적 메시지 전송
   - correlation ID: `chatId:timestamp` 형식으로 로깅
   - Verify: `npx tsc --noEmit`

6. [ ] `src/router/notifications/NotificationManager.ts` 생성
   - 진행 상황 텔레그램 전송 (10초 간격 제한: 마지막 전송 시각 추적)
   - 완료/실패 알림 (항상 즉시 전송)
   - **Telegram 발신 속도 제한**: leaky bucket 큐 (20 msg/sec per chat, Telegram Bot API 제한 준수), 429 응답 시 Retry-After 헤더 기반 대기
   - 방해금지 시간: 23:00~07:00 (긴급 알림 제외)
   - TelegramBot.sendResponse() 활용
   - Verify: `npx tsc --noEmit`

### Phase 1.4: 개발 라우트 (DevRoute)
7. [ ] `src/router/resolvers/RepoResolver.ts` 생성
   - 3단계 경로 해결:
     1. 별칭 매칭: `~/.vibe/router.json`의 `repos.aliases`에서 키 검색
     2. WorkSpace 스캔: `repos.basePaths`에서 디렉토리명 부분 매칭
     3. 절대 경로: 직접 사용 (existsSync 확인)
   - 크로스 플랫폼: path.resolve 사용, Windows `\\` / macOS `/` 호환
   - 캐시: 해결된 경로를 Map에 캐시 (5분 TTL)
   - Verify: unit test + `npx vitest run src/router/resolvers/RepoResolver.test.ts`

8. [ ] `src/router/sessions/DevSessionManager.ts` 생성
   - ClaudeCodeBridge 인스턴스 생성/관리
   - 세션 키: `chatId:projectPath` 조합
   - 기존 세션 재사용: 같은 키면 기존 ClaudeCodeBridge 반환
   - 세션 resume: setSessionId/getSessionId 활용
   - 비활성 2시간 후 자동 종료 (타이머 기반)
   - 최대 동시 세션: 3개 (configurable)
   - Verify: `npx tsc --noEmit`

9. [ ] `src/router/qa/TelegramQABridge.ts` 생성
   - Claude Code permission_request 처리:
     - 읽기 전용 도구 자동 승인 (명시적 허용 목록): Read, Glob, Grep, WebSearch, WebFetch, Ls (`qa.autoApproveTools` 배열로 설정)
     - 허용 목록에 없는 도구는 수동 승인 필요 (미승인 시 거부, fail-safe 원칙)
     - 수동 승인 대상: 텔레그램 인라인 키보드 (승인/거부 버튼) 전송
   - Claude Code 일반 질문 처리:
     - 텔레그램 텍스트로 전송 + 답장 대기
   - **60초 타임아웃 → 안전 모드 기반 자동 진행** (핵심 결정)
     - 읽기 전용 도구: 타임아웃 시 자동 승인
     - 쓰기/삭제 도구: 타임아웃 시 기본 거부 (deny), `qa.writeOnTimeout` 설정으로 "ai_decide" 허용 가능
     - "ai_decide" 모드에서도 파괴적 명령(rm -rf, push --force 등) 블랙리스트는 항상 거부
     - 설정: `qa.maxWaitSeconds` (기본 60), `qa.readOnTimeout` (기본 "approve"), `qa.writeOnTimeout` (기본 "deny")
   - 답장 매칭: Telegram reply_to_message_id 기반
   - Verify: unit test + `npx vitest run src/router/qa/TelegramQABridge.test.ts`

10. [ ] `src/router/handlers/GitOpsHandler.ts` 생성
    - git commit: spawn('git', ['commit', '-m', message]) — args array 사용
    - git push: spawn('git', ['push'])
    - PR 생성: spawn('gh', ['pr', 'create', ...args])
    - 완료 후 git status 요약 텍스트 생성
    - 크로스 플랫폼: 'git' / 'gh' 명령어 경로 해결
    - Verify: `npx tsc --noEmit`

11. [ ] `src/router/routes/DevRoute.ts` 생성
    - canHandle: intent.category === 'development'
    - execute 흐름:
      1. RepoResolver로 프로젝트 경로 해결
      2. DevSessionManager에서 세션 획득
      3. TelegramQABridge 연결 (permission_request/질문 포워딩)
      4. ClaudeCodeBridge에 프롬프트 전송
      5. 스트림 응답을 NotificationManager로 진행 알림
      6. 완료 시 결과 요약 텔레그램 전송
    - VIBE 커맨드 지원: /vibe.spec, /vibe.run, /vibe.analyze 등
    - Verify: integration test

### Phase 1.5: 브릿지 교체 및 통합
12. [ ] `src/bridge/model-a-bridge.ts` 생성 (telegram-bridge.ts 교체)
    - ModelARouter 초기화
    - TelegramBot 연결 (onMessage → router.handleMessage)
    - 라우트 등록 (Phase 1에서는 DevRoute만)
    - 설정 로드: `~/.vibe/router.json`
    - graceful shutdown: SIGINT/SIGTERM 핸들링
    - Verify: 수동 테스트 (텔레그램 메시지 전송 → 응답 확인)

13. [ ] `src/cli/commands/telegram.ts` 수정
    - `vibe telegram start` → model-a-bridge.ts 실행
    - `vibe telegram stop` → 프로세스 종료
    - `vibe telegram status` → 상태 확인
    - Verify: `vibe telegram start` 실행 확인

14. [ ] `src/interface/types.ts` 수정
    - 라우트 관련 타입 추가 (필요한 경우)
    - 기존 타입과 충돌 없이 확장
    - Verify: `npx tsc --noEmit`

### Phase 1.6: 테스트
15. [ ] Unit Tests 작성
    - `src/router/IntentClassifier.test.ts`: 3단계 분류 정확도 (각 카테고리 최소 3개 케이스)
    - `src/router/resolvers/RepoResolver.test.ts`: 별칭, 스캔, 절대경로, 미발견 케이스
    - `src/router/qa/TelegramQABridge.test.ts`: 자동승인, 수동승인, 타임아웃, 답장매칭
    - Verify: `npx vitest run`

16. [ ] Integration Tests 작성
    - `src/router/ModelARouter.test.ts`: 메시지→분류→라우팅→실행 전체 파이프라인
    - Verify: `npx vitest run`
</task>

## Constraints
<constraints>
- 기존 ExternalMessage, ClaudeStreamMessage, JobStatus 타입 시스템 100% 준수
- 기존 모듈(TelegramBot, ClaudeCodeBridge, JobManager 등)은 수정하지 않고 활용만
- spawn with args array 사용 (shell injection 방지)
- 입력 유효성 검증: 모든 사용자 입력은 검증 후 처리
- 로그에 토큰/API 키 노출 금지 (logger 래퍼에서 필터링)
- 크로스 플랫폼: Windows `\\` / macOS `/` 경로 호환 (path.resolve 사용)
- 함수 길이 30줄 이내 (권장), 50줄 이내 (허용)
- Nesting depth 3 이하
- No `any` 타입 → `unknown` + type guards
- Explicit return types
- 에러 핸들링 필수 (try-catch + 사용자 친화적 메시지)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/types.ts`
- `src/router/ModelARouter.ts`
- `src/router/IntentClassifier.ts`
- `src/router/RouteRegistry.ts`
- `src/router/routes/BaseRoute.ts`
- `src/router/routes/DevRoute.ts`
- `src/router/resolvers/RepoResolver.ts`
- `src/router/sessions/DevSessionManager.ts`
- `src/router/qa/TelegramQABridge.ts`
- `src/router/handlers/GitOpsHandler.ts`
- `src/router/notifications/NotificationManager.ts`
- `src/bridge/model-a-bridge.ts`

### Files to Modify
- `src/cli/commands/telegram.ts` (router start/stop 추가)
- `src/interface/types.ts` (라우트 관련 타입 추가 시)

### Test Files to Create
- `src/router/IntentClassifier.test.ts`
- `src/router/resolvers/RepoResolver.test.ts`
- `src/router/qa/TelegramQABridge.test.ts`
- `src/router/ModelARouter.test.ts`

### Configuration
- `~/.vibe/router.json` (사용자 설정 파일, 런타임 로드)

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 텔레그램 메시지 수신 → IntentClassifier가 7개 카테고리 중 하나로 분류
- [ ] AC-2: "vibe에서 테스트 파일 만들어줘" → DevRoute가 Claude Code 세션 생성 → 실행 → 완료 알림
- [ ] AC-3: Claude Code permission_request → 텔레그램 인라인 키보드 전송 → 60초 타임아웃 시 AI 자동 진행
- [ ] AC-4: 읽기 전용 도구(Read, Glob, Grep) → 자동 승인 (텔레그램 전송 없이)
- [ ] AC-5: 같은 chatId + projectPath → 기존 Claude Code 세션 재사용 (resume)
- [ ] AC-6: 진행 알림은 10초 간격 제한, 방해금지 시간(23:00~07:00)에는 미전송
- [ ] AC-7: 모든 git 작업은 spawn args array 사용 (shell injection 불가)
- [ ] AC-8: update_id 기반 중복 메시지 방지
- [ ] AC-9: `npx tsc --noEmit` 빌드 성공
- [ ] AC-10: `npx vitest run` 모든 테스트 통과
- [ ] AC-11: 크로스 플랫폼(Windows/macOS) 경로 정상 동작

### Ambiguity Scan Auto-fixes

- conversation 카테고리: LLM 직접 응답 (라우트 없이 SmartRouter로 답변 생성, 응답 시간 목표 <3초)
- DevSessionManager 최대 동시 세션(3개) 초과: FIFO 정책 (가장 오래된 비활성 세션 종료 후 생성)
- TelegramQABridge 동시 permission_request: Queue 직렬화, 순차 처리
- IntentClassifier 응답 시간 목표 (내부 처리 시간, 네트워크 RTT 제외): 명시적 명령 <50ms, 키워드 heuristic <100ms, LLM fallback <3초
- 네트워크 에러 처리: 외부 API 호출 실패 시 3회 재시도 (exponential backoff, base 1s, max 4s) 후 사용자 친화적 에러 메시지 전송
- LLM 분류 실패 시: conversation fallback (기본 대화로 처리)
- Circuit Breaker 설정: 실패율 50% (최소 5회 요청 윈도우), open 30초 → half-open 1회 프로브 → 성공 시 close. 서비스별 독립 운용
- Phase 1 composite 처리: IntentClassifier가 composite로 분류만 수행, 실제 실행은 Phase 4 CompositeRoute에서 담당. Phase 4 미구현 시 "복합 명령은 아직 지원하지 않습니다" 안내 메시지 전송
</acceptance>
