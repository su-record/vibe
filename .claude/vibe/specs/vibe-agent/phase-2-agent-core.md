---
status: pending
phase: 2
title: Agent Core Loop
---

# SPEC: vibe-agent - Phase 2: Agent Core Loop

## Persona
<role>
Senior TypeScript developer specializing in event-driven agent systems.
- 기존 ModelARouter 파이프라인에 정통
- LLM tool-use loop 구현 경험
- Telegram Bot 통합 경험
</role>

## Context
<context>
### Background
Phase 1에서 HeadModelProvider, ToolRegistry가 준비되었다. 이제 기존 ModelARouter의 메시지 처리 파이프라인을 Agent Loop로 교체한다.

### Current Pipeline (교체 대상)
```
message → dedup → preprocess → IntentClassifier.classify() → RouteRegistry.findRoute() → route.execute() → respond
```

### Target Pipeline
```
message → dedup → preprocess → AgentLoop.process(message, tools) → HeadModel.chat() → [tool_call → execute → result]* → final response → respond
```

### Related Code
- `src/router/ModelARouter.ts`: 현재 메시지 파이프라인 (dedup, voice transcription, callback query)
- `src/router/IntentClassifier.ts`: 교체 대상
- `src/router/RouteRegistry.ts`: 교체 대상
- `src/agent/types.ts`: Phase 1에서 정의한 타입들
- `src/agent/HeadModelSelector.ts`: Phase 1에서 구현
- `src/agent/ToolRegistry.ts`: Phase 1에서 구현
</context>

## Task
<task>
### Phase 2-1: AgentLoop 구현
1. [ ] `src/agent/AgentLoop.ts` 생성
   - `process(message: ExternalMessage, services: RouteServices)`: 메인 에이전트 루프
   - 메시지 → HeadModel에 전달 (system prompt + tools)
   - tool_call 응답 시: ToolRegistry에서 tool 찾기 → 실행 → 결과를 HeadModel에 반환 → 반복
   - 최종 텍스트 응답 시: Telegram으로 전송
   - Max iterations: 10 (무한 루프 방지)
   - Tool call graph depth 추적 (cycle detection)
   - **Idempotency**: tool_call.id 기반 중복 실행 방지 (동일 toolCallId는 캐시된 결과 반환)
   - **HeadModel 호출 timeout**: 개별 호출 10초 (AbortController), 실패 시 1회 재시도 후 에러
   - File: `src/agent/AgentLoop.ts`
   - Verify: `npm test`

### Phase 2-2: System Prompt 관리
1. [ ] `src/agent/SystemPrompt.ts` 생성
   - 에이전트 persona 정의 (개인 AI 어시스턴트)
   - 사용 가능한 tool 목록 주입
   - 사용자 컨텍스트 (이름, 선호 언어, 시간대)
   - Tool 사용 가이드라인 (언제 어떤 tool을 쓸지)
   - File: `src/agent/SystemPrompt.ts`

### Phase 2-3: ToolExecutor 구현
1. [ ] `src/agent/ToolExecutor.ts` 생성
   - `execute(toolCall: ToolCall)`: tool argument 검증 (Zod) → tool 함수 실행 → 결과 반환
   - 개별 tool timeout: 30초 (AbortController)
   - 실행 결과 정규화: `{ status, content, latency }`
   - **결과 크기 제한**: content > 10KB 시 앞/뒤 1KB 유지 + `[...truncated {size}KB...]` 마커 삽입 (LLM 재호출 없이 단순 truncate)
   - 에러 발생 시 에러 메시지 템플릿 기반 변환 (Phase 2 constraints 참조)
   - **HeadModel 잘못된 tool_call 처리**: JSON 파싱 실패 또는 미등록 tool → 에러를 HeadModel에 피드백 → 최대 2회 재시도 후 사용자에게 에러
   - Tool call 감사 로깅: `{ timestamp, toolName, args (마스킹), latencyMs, success, errorType? }`
   - **감사 로그 마스킹 규칙**: 키 이름에 `key`, `token`, `secret`, `password`, `auth` 포함 시 값을 `***` 처리
   - File: `src/agent/ToolExecutor.ts`
   - Verify: `npm test`

### Phase 2-4: ModelARouter 교체
1. [ ] `src/router/ModelARouter.ts` 수정
   - 기존 classify → findRoute → execute 흐름을 AgentLoop.process()로 교체
   - dedup 로직 유지
   - voice transcription 전처리 유지
   - callback query 처리 유지
   - File: `src/router/ModelARouter.ts`

### Phase 2-5: Conversation State 관리
1. [ ] `src/agent/ConversationState.ts` 생성
   - 대화 이력 관리 (chatId별 메시지 배열)
   - 단기 컨텍스트: 최근 20개 메시지 (sliding window)
   - Tool 결과 요약: 큰 결과는 자동 압축
   - Token counting: 보수적 추정 (한국어/유니코드: 2 chars ≈ 1 token, ASCII: 4 chars ≈ 1 token, 20% 마진)
   - **최대 컨텍스트 토큰 제한**: GPT 32K, Claude 100K (System prompt 포함)
   - **System Prompt 보호**: 슬라이딩 윈도우에서 System Prompt은 항상 첫 번째로 고정 (eviction 불가)
   - **컨텍스트 구성**: `[SystemPrompt, ...RecentMessages]` (System Prompt은 윈도우 크기에서 제외)
   - 세션 만료: 30분 비활성 시 컨텍스트 초기화
   - File: `src/agent/ConversationState.ts`
   - Verify: `npm test`
</task>

## Constraints
<constraints>
- ModelARouter의 dedup/voice/callback 로직은 보존
- IntentClassifier/RouteRegistry는 Phase 6 마이그레이션까지 삭제하지 않음 (fallback용)
- Agent Loop max iterations: 10
- Tool timeout: 30초 (AbortController)
- Conversation window: 최근 20개 메시지
- Session timeout: 30분
- **응답 시간 목표**: 단순 텍스트 응답 < 3초, Tool call 포함 < 10초 (tool 실행 시간 제외)
- **HeadModel 호출 latency budget**: Time to First Token < 2초 (스트리밍), 전체 응답 timeout 10초
- **ConversationState tool 결과 압축 임계값**: 4KB 초과 시 자동 요약 후 컨텍스트에 저장
- **에러 메시지 템플릿**:
  - HeadModel API 실패: "AI 모델 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
  - Tool 실행 실패: "도구 실행 중 오류가 발생했습니다: {tool_name} - {error_summary}"
  - Max iterations: "처리 한도(10회)를 초과했습니다. 요청을 더 구체적으로 해주세요."
  - Session expired: "세션이 만료되었습니다. 새 대화를 시작합니다."
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/AgentLoop.ts`
- `src/agent/SystemPrompt.ts`
- `src/agent/ToolExecutor.ts`
- `src/agent/ConversationState.ts`

### Files to Modify
- `src/router/ModelARouter.ts` (Agent Loop 통합)

### Verification Commands
- `npm run build`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 텍스트 메시지가 HeadModel에 전달되어 응답을 받는다
- [ ] AC-2: HeadModel이 tool_call 반환 시 ToolExecutor가 실행하고 결과를 되돌린다
- [ ] AC-3: Multi-turn tool call이 동작한다 (tool → result → tool → result → final)
- [ ] AC-4: Max 10 iterations 초과 시 루프가 중단되고 사용자에게 알린다
- [ ] AC-5: Tool execution timeout 30초 동작한다
- [ ] AC-6: 대화 이력이 chatId별로 관리된다 (최근 20개)
- [ ] AC-7: 30분 비활성 시 세션이 초기화된다
- [ ] AC-8: 기존 dedup/voice transcription이 정상 동작한다
- [ ] AC-9: HeadModel API 실패 시 에러 메시지 전송 후 graceful 종료
- [ ] AC-10: 단순 텍스트 응답이 3초 이내에 완료된다 (HeadModel 응답 시간 기준)
- [ ] AC-11: 빌드 성공 (`npm run build`)
- [ ] AC-12: 테스트 통과 (`npm test`)
</acceptance>
