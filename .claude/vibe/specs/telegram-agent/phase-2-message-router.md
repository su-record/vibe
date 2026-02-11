---
status: pending
phase: 2
createdAt: 2026-02-06T17:31:00+09:00
---

# SPEC: Phase 2 - 의도 분류 + 라우팅 엔진

## Persona

<role>
Senior TypeScript engineer specializing in:
- 자연어 의도 분류(intent classification)
- 라우팅 엔진 설계
- 멀티 LLM 오케스트레이션
- Vibe SmartRouter/LLMCluster 활용
</role>

## Context

<context>

### Background
텔레그램 메시지를 받으면 의도를 분류하여 최적의 처리 경로로 라우팅해야 한다.
단순 Q&A는 SmartRouter로 즉시 응답하고(30초 이내), 코드 분석은 LLMCluster로 멀티 관점 응답,
개발 작업은 BackgroundManager로 비동기 처리한다.

### Why
- 모든 메시지를 Claude CLI로 보내면 느리고 비효율적
- SmartRouter 활용으로 GPT/Gemini/Kimi 자동 선택 가능
- LLMCluster로 3개 LLM 병렬 분석 → 종합 응답
- 개발 작업은 비동기 처리가 필수 (수 분 소요)

### Routing Rules

| 유형 | 패턴 예시 | 처리 경로 |
|------|----------|----------|
| quick | "날씨 어때?", "이거 뭐야?" | SmartRouter.route() |
| multi-llm | "이 코드 분석해줘", "리뷰해줘" | LLMCluster.multiQuery() |
| dev-task | "~/workspace에서 로그인 만들어" | BackgroundManager → Claude CLI |
| local | "디스크 사용량", "파일 찾아줘", "메일 보내" | Claude CLI (즉시) |
| memory | "메모해", "검색해", "기억나?" | MemoryManager 직접 |

### Related Code
- `src/orchestrator/SmartRouter.ts`: `route()`, `getProviderPriority()`
- `src/orchestrator/LLMCluster.ts`: `multiQuery()`, `gptOrchestrate()`
- `src/orchestrator/BackgroundManager.ts`: `launch()`, `poll()`
- `src/lib/MemoryManager.ts`: `save()`, `recall()`, `search()`
- `src/job/IntentParser.ts`: 기존 의도 파서 참고

</context>

## Task

<task>

### 1. 메시지 의도 분류기 (`src/bridge/message-router.ts`)

1. [ ] `MessageIntent` 타입 정의
   ```typescript
   type MessageIntent =
     | { type: 'quick'; category: 'general' | 'web-search' | 'code-analysis' }
     | { type: 'multi-llm'; category: 'review' | 'analysis' | 'comparison' }
     | { type: 'dev-task'; workspace: string; task: string }
     | { type: 'local'; category: 'file' | 'system' | 'mail' | 'calendar' | 'screenshot' | 'document' }
     | { type: 'memory'; action: 'save' | 'search' | 'list' | 'remind' }
   ```

2. [ ] `classifyIntent(message: string, context?: SessionContext): Promise<MessageIntent>` 구현
   - **1단계**: 규칙 기반 (키워드/정규식)으로 빠른 분류
     - `/status`, `/tasks` 등 슬래시 명령 → quick/general
     - "메모해", "기억해", "저장해" → memory/save
     - "검색해", "찾아봐" → memory/search
     - "~/workspace", "프로젝트", "만들어줘", "구현해" → dev-task
     - "분석해", "리뷰해", "비교해" → multi-llm
     - "디스크", "CPU", "프로세스", "메모리" → local/system
     - "파일", "폴더", "백업" → local/file
     - "메일", "이메일", "gmail" → local/mail
     - "일정", "캘린더", "스케줄" → local/calendar
     - "PDF", "다이어그램", "문서" → local/document
   - **2단계**: 규칙으로 분류 실패 시 SmartRouter로 LLM 분류
     - 분류 전용 프롬프트로 intent 타입 결정
     - 응답을 파싱하여 MessageIntent 반환

3. [ ] `extractWorkspace(message: string, defaultWorkspace?: string): string` 구현
   - 메시지에서 경로 패턴 추출 (`~/workspace/xxx`, `/path/to/dir`)
   - `~`를 `os.homedir()`으로 치환
   - 경로가 없으면 defaultWorkspace 또는 `os.homedir()` 반환
   - 경로 유효성 검증 (존재 여부, 디렉토리 여부)

### 2. 라우팅 엔진

4. [ ] `MessageRouter` 클래스 구현
   ```typescript
   class MessageRouter {
     constructor(config: RouterConfig)
     async route(message: ExternalMessage, chatId: string): Promise<RouteResult>
   }
   ```

5. [ ] `RouteResult` 인터페이스 정의
   ```typescript
   interface RouteResult {
     response: string;
     intent: MessageIntent;
     provider?: string;       // 사용된 LLM provider
     duration: number;        // 처리 시간 ms
     async?: boolean;         // 비동기 작업 여부
     taskId?: string;         // BackgroundManager taskId
   }
   ```

6. [ ] 각 라우팅 경로 구현

   **quick 경로:**
   - SmartRouter.route() 호출
   - TaskType 매핑: general → 'general', web-search → 'web-search', code-analysis → 'code-analysis'
   - 세션 컨텍스트를 프롬프트에 포함

   **multi-llm 경로:**
   - LLMCluster.multiQuery() 호출 (GPT + Gemini + Kimi 병렬)
   - 3개 응답을 종합하는 요약 프롬프트 생성
   - SmartRouter로 종합 요약 실행

   **dev-task 경로:**
   - workspace 추출
   - BackgroundManager.launch() 호출
   - taskId 반환 (비동기)
   - 즉시 "작업 시작됨" 응답

   **local 경로:**
   - spawnClaudeAgent() 호출
   - 카테고리별 시스템 프롬프트 + allowedTools 지정
   - 즉시 응답

   **memory 경로:**
   - MemoryManager 직접 호출
   - save: `save(key, value, 'telegram')`
   - search: `search(query)` → 결과 포매팅
   - list: `list('telegram')` → 목록 포매팅
   - remind: 리마인더 저장 (Evidence로)

7. [ ] `RouterConfig` 인터페이스
   ```typescript
   interface RouterConfig {
     defaultWorkspace?: string;
     maxTurns?: number;         // Claude CLI 기본 턴 수 (5)
     timeout?: number;          // Claude CLI 타임아웃 ms (300000)
     provider?: 'auto' | 'claude' | 'gpt' | 'gemini';
   }
   ```

</task>

## Constraints

<constraints>
- 규칙 기반 분류를 우선하여 불필요한 LLM 호출 방지
- SmartRouter/LLMCluster는 싱글톤(getSmartRouter/getLLMCluster)으로 접근
- 경로 추출 시 path traversal 방지 (isSafePath 검증)
- multi-llm 응답 종합 시 4096자 제한 준수
- dev-task workspace는 반드시 존재하는 디렉토리여야 함
- memory 작업 시 projectPath는 workspace 또는 cwd 사용
- 분류 실패 시 기본값은 'quick/general' (안전한 폴백)
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/bridge/message-router.ts` - 의도 분류기 + 라우팅 엔진

### Files to Modify
- (없음 - Phase 4에서 telegram-bridge.ts에 연동)

### Verification Commands
- `npm run build`
- `npx vitest run src/bridge/message-router.test.ts`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] 규칙 기반 분류로 "메모해 XXX"가 memory/save로 분류됨
- [ ] "~/workspace/app에서 로그인 만들어"가 dev-task로 분류되고 workspace가 추출됨
- [ ] "이 코드 분석해줘"가 multi-llm/analysis로 분류됨
- [ ] "디스크 사용량 확인"이 local/system으로 분류됨
- [ ] quick 경로에서 SmartRouter.route()가 호출됨
- [ ] multi-llm 경로에서 LLMCluster.multiQuery()로 3개 LLM 병렬 실행됨
- [ ] dev-task 경로에서 BackgroundManager.launch()가 호출되고 taskId 반환됨
- [ ] memory/save 경로에서 MemoryManager.save()가 호출됨
- [ ] 분류 실패 시 quick/general로 폴백됨
- [ ] workspace 경로에 path traversal 시도 시 거부됨
- [ ] `npm run build` 성공
</acceptance>
