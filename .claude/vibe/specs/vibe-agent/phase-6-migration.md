---
status: pending
phase: 6
title: Migration & Testing
---

# SPEC: vibe-agent - Phase 6: Migration & Testing

## Persona
<role>
Senior TypeScript developer specializing in system migration and testing.
- 점진적 마이그레이션 전략 (Strangler Fig) 전문
- 기존 시스템과 신규 시스템 병렬 운영 경험
</role>

## Context
<context>
### Background
Phase 1-5에서 새 에이전트 아키텍처가 완성되었다. 이제 기존 코드 기반 라우터에서 새 에이전트로 안전하게 전환한다.

### Migration Strategy: Strangler Fig Pattern
기존 시스템을 한번에 제거하지 않고, 새 시스템을 점진적으로 활성화한다.

```
Phase 6a: Shadow Mode (병렬 실행, 로깅만)
Phase 6b: Gradual Cutover (일부 메시지 새 시스템으로)
Phase 6c: Full Cutover (전체 전환)
Phase 6d: Cleanup (구 시스템 제거)
```

### Related Code
- `src/router/IntentClassifier.ts`: 삭제 대상
- `src/router/RouteRegistry.ts`: 삭제 대상
- `src/router/ModelARouter.ts`: 이미 Phase 2에서 AgentLoop으로 교체
</context>

## Task
<task>
### Phase 6-1: Shadow Mode
1. [ ] `src/agent/MigrationGate.ts` 생성
   - `shouldUseAgent(message)`: 새 에이전트 사용 여부 판단
   - Shadow mode: 양쪽 모두 실행, 결과 비교, 차이 로깅
   - **Shadow dry-run**: Agent 파이프라인에서 write/execute scope tool은 실행하지 않고 stub 결과 반환 (사이드이펙트 방지)
   - **비교 전략**: Legacy 결과(Route name + 응답 텍스트) vs Agent 결과(Tool name + 응답 텍스트)
     - Tool call 비교: Legacy intent → Agent tool 매핑 테이블 기반 (예: 'Weather' intent → 'google_search' tool)
     - 텍스트 응답: 길이 비율 비교 (±50% 이내), 에러 발생 여부
     - 비교 로그: `{ chatId, legacy: {intent, latencyMs, error}, agent: {tool, latencyMs, error}, match: boolean }`
   - Config flag: `agentMode: 'legacy' | 'shadow' | 'agent' | 'full'`
   - File: `src/agent/MigrationGate.ts`

### Phase 6-2: Feature Flag 통합
1. [ ] `.claude/vibe/config.json`에 agentMode 설정 추가
   - `"agentMode": "legacy"` (기본값, 기존 시스템)
   - `"agentMode": "shadow"` (병렬 실행 + 비교 로깅)
   - `"agentMode": "agent"` (새 에이전트, 실패 시 legacy fallback)
   - `"agentMode": "full"` (새 에이전트만)

### Phase 6-3: 통합 테스트
1. [ ] `src/agent/__tests__/AgentLoop.test.ts` 생성
   - 텍스트 메시지 → 응답 플로우
   - Tool call → execute → result 플로우
   - Multi-turn tool call 플로우
   - Max iterations 초과 테스트
   - Tool timeout 테스트
   - File: `src/agent/__tests__/AgentLoop.test.ts`

2. [ ] `src/agent/__tests__/HeadModelSelector.test.ts` 생성
   - GPT OAuth 있을 때 GPT 선택
   - GPT 없을 때 Claude 선택
   - Circuit breaker 동작
   - File: `src/agent/__tests__/HeadModelSelector.test.ts`

3. [ ] `src/agent/__tests__/ToolRegistry.test.ts` 생성
   - Tool 등록/조회/삭제
   - OpenAI/Anthropic format 변환
   - Zod 검증
   - File: `src/agent/__tests__/ToolRegistry.test.ts`

4. [ ] `src/agent/__tests__/JobManager.test.ts` 생성
   - Job 생성/실행/완료/취소
   - 동시 실행 제한
   - Timeout 동작
   - File: `src/agent/__tests__/JobManager.test.ts`

### Phase 6-4: Cleanup (Full Cutover 이후)
1. [ ] `agentMode: "full"` 확인 후 구 시스템 제거
   - `src/router/IntentClassifier.ts` 삭제
   - `src/router/RouteRegistry.ts` 삭제
   - 관련 import/export 정리
   - File: 여러 파일
</task>

## Constraints
<constraints>
- Shadow mode에서는 성능 오버헤드 허용 (양쪽 실행)
- Legacy fallback은 `agentMode: "agent"` 에서만 동작
- Cleanup은 반드시 `agentMode: "full"`에서 충분한 검증 후 실행
- 테스트는 실제 LLM API 호출 없이 mock으로 수행
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/MigrationGate.ts`
- `src/agent/__tests__/AgentLoop.test.ts`
- `src/agent/__tests__/HeadModelSelector.test.ts`
- `src/agent/__tests__/ToolRegistry.test.ts`
- `src/agent/__tests__/JobManager.test.ts`

### Files to Modify
- `.claude/vibe/config.json` (agentMode 추가)
- `src/router/ModelARouter.ts` (MigrationGate 통합)

### Files to Delete (Phase 6-4, Full Cutover 이후)
- `src/router/IntentClassifier.ts`
- `src/router/RouteRegistry.ts`

### Verification Commands
- `npm run build`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: Shadow mode에서 legacy와 agent 양쪽 실행되고 차이가 로깅된다
- [ ] AC-2: agentMode: "agent"에서 실패 시 legacy fallback이 동작한다
- [ ] AC-3: agentMode: "full"에서 새 에이전트만 실행된다
- [ ] AC-4: AgentLoop 통합 테스트가 통과한다 (mock 기반)
- [ ] AC-5: HeadModelSelector 테스트가 통과한다
- [ ] AC-6: ToolRegistry 테스트가 통과한다
- [ ] AC-7: JobManager 테스트가 통과한다
- [ ] AC-8: IntentClassifier/RouteRegistry 삭제 후 빌드 성공한다
- [ ] AC-9: 전체 테스트 통과 (`npm test`)
</acceptance>
