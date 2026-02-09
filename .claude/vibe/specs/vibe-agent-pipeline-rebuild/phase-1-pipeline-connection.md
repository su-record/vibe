---
status: pending
phase: 1
parent: _index.md
---

# SPEC: Phase 1 - Pipeline Connection (SessionPool → AgentLoop)

## Persona
<role>
Senior TypeScript architect who specializes in Node.js daemon architectures.
- SessionPool.executeRequest() STUB를 실제 AgentLoop 호출로 교체
- telegram-assistant-bridge.ts L160-172 패턴을 정확히 복제
- 기존 코드 패턴(AsyncLocalStorage, circuit breaker) 유지
</role>

## Context
<context>
### Background
Vibe의 외부 메시지 파이프라인이 **80% 구현, 0% 작동** 상태.
원인: `SessionPool.executeRequest()`가 canned string을 반환하는 STUB.

### 현재 흐름 (Broken)
```
Interface(Telegram/Slack/iMessage) → InterfaceManager.onMessage()
  → SessionPool.sendRequest() → executeRequest() ← STUB (canned string)
  → Interface.sendResponse() ← 실제 처리 없음
```

### 목표 흐름 (Working)
```
Interface → InterfaceManager.onMessage()
  → SessionPool.sendRequest() → executeRequest()
    → AgentLoop.process() → HeadModel.chat() → ToolExecutor → response
  → Interface.sendResponse() ← AI 응답
```

### Reference Code (Working Pattern)
`src/bridge/telegram-assistant-bridge.ts` L160-172:
```typescript
const headSelector = new HeadModelSelector();
const toolRegistry = new ToolRegistry();
registerAllTools(toolRegistry);
const agentLoop = new AgentLoop({
  headSelector, toolRegistry,
  systemPromptConfig: { userName: '사용자', language: 'ko', timezone: 'Asia/Seoul' },
});
router.setAgentLoop(agentLoop);
```

### Tech Stack
- HeadModelSelector: GPT 5.3 Codex primary, Claude fallback, circuit breaker
- AgentLoop: max 10 iterations, idempotency cache, channel tool binding
- ToolExecutor: 30s timeout, 10KB truncation, audit logging

### Related Code
- `src/daemon/SessionPool.ts`: L204-211 (STUB)
- `src/daemon/VibeDaemon.ts`: start() method (AgentLoop 미초기화)
- `src/daemon/InterfaceManager.ts`: registerMessageHandler()
- `src/agent/AgentLoop.ts`: process() method
- `src/agent/HeadModelSelector.ts`: select() with circuit breaker
</context>

## Task
<task>
### Task 1.1: ToolDefinition 타입 추가 + ToolRegistry 제거
1. [ ] `src/agent/types.ts`에 `ToolDefinition` 인터페이스 추가
   - `{ name: string; description: string; parameters: JsonSchema; handler: (args: Record<string, unknown>) => Promise<string>; scope: ToolScope }`
   - 기존 `RegisteredTool` (Zod 의존) 유지하되 deprecated 주석 추가
   - `import type { z } from 'zod'` 제거는 Phase 1에서 하지 않음 (점진적)
   - Verify: `npx tsc --noEmit`

2. [ ] 12개 도구 파일을 JSON Schema 직접 정의로 변환
   - Files: `src/agent/tools/{claude-code,gemini-stt,google-search,kimi-analyze,manage-memory,send-imessage,send-slack,send-telegram,vision-analyze,vision-capture,web-browse}.ts`
   - 각 파일에서:
     a. `z.object({...})` 스키마를 `JsonSchema` 객체로 교체
     b. `import { z } from 'zod'` 제거
     c. `import type { ToolRegistrationInput } from '../ToolRegistry.js'` → `import type { ToolDefinition } from '../types.js'`
     d. export 타입을 `ToolDefinition`으로 변경
   - Verify: `npx tsc --noEmit`

3. [ ] `src/agent/tools/index.ts` 수정
   - `registerAllTools(registry: ToolRegistry)` → `getAllTools(): ToolDefinition[]`
   - ToolRegistry 의존성 제거
   - Verify: `npx tsc --noEmit`

4. [ ] `src/agent/ToolRegistry.ts` 삭제
   - 참조하는 파일 확인 후 제거
   - `src/agent/index.ts`에서 export 제거
   - Verify: `npx tsc --noEmit`

### Task 1.2: ToolExecutor 수정
1. [ ] `src/agent/ToolExecutor.ts`를 ToolDefinition 기반으로 수정
   - ToolRegistry 의존 제거
   - constructor에서 `ToolDefinition[]` 배열 직접 수신
   - `execute()`: tool lookup을 Map<name, ToolDefinition>으로
   - Zod validation 제거, handler 직접 호출
   - 기존 기능 유지: 30s per-tool timeout, 10KB truncation (JSON 구조 보존: 배열은 끝 요소부터 제거, 문자열은 말줄임), audit logging, sensitive field masking
   - Verify: `npx vitest run src/agent/ToolExecutor.test.ts`

### Task 1.3: AgentLoop 수정
1. [ ] `src/agent/AgentLoop.ts` deps에서 ToolRegistry 제거
   - `AgentLoopDeps.toolRegistry` → `AgentLoopDeps.tools: ToolDefinition[]`
   - ToolExecutor 초기화 시 tools 배열 전달
   - `buildTools()` 메서드: ToolDefinition[] → OpenAITool[] 변환 직접 구현
   - 기존 기능 유지: channel binding, idempotency, max 10 iterations
   - Time budget 체크: 새 iteration 시작 전 남은 시간 확인, <5초 시 최종 요약 응답 반환
   - Verify: `npx vitest run src/agent/AgentLoop.test.ts`

### Task 1.4: SessionPool.executeRequest() 구현
1. [ ] `src/daemon/SessionPool.ts`에 AgentLoop 통합
   - 세션별 AgentLoop 인스턴스 (lazy init)
   - `executeRequest()` 구현:
     a. HeadModelSelector 인스턴스 (전역 1개, 재사용)
     b. getAllTools()로 도구 목록 로드
     c. AgentLoop 생성 (세션별)
     d. ExternalMessage → AgentLoop.process() 호출
     e. onProgress 콜백으로 최종 응답 수집
     f. 문자열 반환
     g. 전체 요청 60초 타임아웃 (AbortController)
     h. 실패 시 사용자 친화적 에러 메시지 반환 (내부 스택 미노출)
   - 동시 요청 직렬화:
     a. 세션별 Mutex (async-mutex 패턴, Promise 체인)
     b. 최대 대기 큐: 5개 (초과 시 "busy" 응답)
     c. 타임아웃 포함 대기: 30초 (큐에서 대기 최대 시간)
   - Verify: `npm run build`

### Task 1.5: VibeDaemon 초기화 연결
1. [ ] `src/daemon/VibeDaemon.ts` start() 수정
   - HeadModelSelector 인스턴스 생성
   - SessionPool에 headSelector 전달
   - Verify: `npm run build && npx vitest run src/daemon/daemon.test.ts`

### Task 1.6: 통합 테스트
1. [ ] `src/daemon/pipeline.test.ts` 작성
   - Mock HeadModel → SessionPool.sendRequest() → 응답 검증
   - Channel별 tool binding 검증 (Telegram/Slack/iMessage)
   - Circuit breaker fallback 검증
   - 동시 요청 직렬화 검증
   - Verify: `npx vitest run src/daemon/pipeline.test.ts`
</task>

## Constraints
<constraints>
- ESM imports: `.js` 확장자 필수
- 기존 tool handler 시그니처 변경 금지: `(args: Record<string, unknown>) => Promise<string>`
- HeadModelSelector의 circuit breaker 로직 변경 금지
- InterfaceManager의 메시지 라우팅 로직 변경 금지 (SessionPool 인터페이스만 사용)
- 기존 bridge 코드(`telegram-assistant-bridge.ts`) 변경 금지
- 점진적 마이그레이션: RegisteredTool 타입은 deprecated 유지 (삭제는 Phase 1 완료 후)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/daemon/pipeline.test.ts` (통합 테스트)

### Files to Modify
- `src/agent/types.ts` (ToolDefinition 추가)
- `src/agent/tools/*.ts` (12개 파일, Zod→JSON Schema)
- `src/agent/tools/index.ts` (registerAllTools→getAllTools)
- `src/agent/ToolExecutor.ts` (ToolRegistry 제거)
- `src/agent/AgentLoop.ts` (deps 변경)
- `src/agent/index.ts` (export 정리)
- `src/daemon/SessionPool.ts` (executeRequest 구현)
- `src/daemon/VibeDaemon.ts` (초기화)

### Files to Delete
- `src/agent/ToolRegistry.ts`

### Verification Commands
- `npx tsc --noEmit` (타입 체크)
- `npm run build` (빌드)
- `npx vitest run src/agent/` (에이전트 테스트)
- `npx vitest run src/daemon/` (데몬 테스트)
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: SessionPool.executeRequest()가 AgentLoop.process()를 호출하여 AI 응답 반환
- [ ] AC-2: 12개 도구가 JSON Schema 직접 정의로 변환되어 GPT function calling 작동
- [ ] AC-3: ToolRegistry.ts가 삭제되고 모든 참조가 제거됨
- [ ] AC-4: HeadModelSelector circuit breaker가 GPT 실패 시 Claude fallback 정상 작동
- [ ] AC-5: 채널별(Telegram/Slack/iMessage) AsyncLocalStorage 컨텍스트 격리 유지
- [ ] AC-6: 동시 요청이 SessionPool에서 직렬화되어 처리됨
- [ ] AC-7: `npx tsc --noEmit` 통과
- [ ] AC-8: `npm run build` 성공
- [ ] AC-9: pipeline.test.ts 모든 테스트 통과
- [ ] AC-10: AgentLoop 단일 요청 처리 시간 60초 이내 (타임아웃 적용)
- [ ] AC-11: 모든 HeadModel 실패 시 사용자 친화적 에러 메시지 반환
</acceptance>
