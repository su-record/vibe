---
status: pending
phase: 1
title: Head Model Selection & Tool Registry
---

# SPEC: vibe-agent - Phase 1: Head Model Selection & Tool Registry

## Persona
<role>
Senior TypeScript architect specializing in LLM agent systems.
- Provider-agnostic abstraction layer 설계 전문
- 기존 GPT/Gemini/AZ 통합 코드에 정통
- Function calling schema 설계 경험
</role>

## Context
<context>
### Background
현재 VIBE는 IntentClassifier (키워드/프리픽스 매칭)로 메시지를 분류한다. 이를 헤드 모델의 function calling으로 교체하려면, 먼저 헤드 모델 선택 로직과 Tool Registry를 구현해야 한다.

### Tech Stack
- TypeScript 5.5+ / Node.js 18+
- 기존 GPT OAuth: `src/lib/gpt-oauth.ts`, `src/lib/gpt/auth.ts`, `src/lib/gpt/chat.ts`
- 기존 Gemini OAuth: `src/lib/gemini/auth.ts`
- 기존 AZ: `src/lib/az/auth.ts`
- 기존 Tool 타입: `src/types/tool.ts` (ToolDefinition, ToolResult)

### Related Code
- `src/lib/gpt/chat.ts`: GPT_MODELS에 `gpt-5.3-codex` 추가 필요
- `src/lib/gpt/auth.ts`: `getAuthInfo()` - OAuth/APIKey/Azure fallback
- `src/orchestrator/SmartRouter.ts`: TASK_LLM_PRIORITY (참고용)
- `src/types/tool.ts`: ToolDefinition 인터페이스 (MCP 스타일)

### Research Findings
- Zod 기반 타입 안전 Tool 스키마 → JSON Schema 자동 생성 (GPT+Gemini+Kimi 합의)
- Provider-agnostic Tool 추상화 (OpenAI/Anthropic 호환)
- Circuit Breaker + Fallback Chain (opossum 패턴)
- Temperature=0 for deterministic tool selection
</context>

## Task
<task>
### Phase 1-1: GPT-5.3-Codex 모델 등록
1. [ ] `src/lib/gpt/chat.ts`의 GPT_MODELS에 `gpt-5.3-codex` 추가
   - File: `src/lib/gpt/chat.ts`
   - Model ID: `gpt-5.3-codex`
   - maxTokens: 32768
   - reasoning: `{ effort: 'high', summary: 'auto' }`
   - Verify: `npm run build`

### Phase 1-2: Agent 핵심 타입 정의
1. [ ] `src/agent/types.ts` 생성
   - `HeadModelProvider` 인터페이스: `chat(messages, tools) → response with tool_calls`
   - `AgentToolSchema` 타입: Zod 기반 provider-agnostic tool 정의
   - `ToolCall` 타입: `{ id: string, name: string, arguments: Record<string, unknown> }`
   - `ToolCallResult` 타입: `{ toolCallId: string, content: string }`
   - `AgentMessage` 타입: `{ role: 'system'|'user'|'assistant'|'tool', content: string, toolCalls?: ToolCall[], toolCallId?: string }`
   - `HeadModelConfig` 타입: `{ provider: 'gpt'|'claude', model: string, temperature: number, maxTokens: number }`
   - File: `src/agent/types.ts`

### Phase 1-3: HeadModel Provider 구현
1. [ ] `src/agent/providers/gpt-head.ts` 생성
   - GPT Codex Backend API로 function calling 요청
   - 기존 `src/lib/gpt/chat.ts`의 chat/chatStream 재사용
   - Streaming function call 감지 (delta.tool_calls 누적)
   - Tool schema → OpenAI format 변환: `{ type: "function", function: { name, description, parameters } }`
   - Temperature=0 고정 (결정론적 tool selection)
   - File: `src/agent/providers/gpt-head.ts`

2. [ ] `src/agent/providers/claude-head.ts` 생성
   - 기존 `@anthropic-ai/claude-agent-sdk` (dependencies에 존재) 활용
   - Claude tool use API 형식으로 변환
   - Tool schema → Anthropic format: `{ name, description, input_schema }`
   - File: `src/agent/providers/claude-head.ts`

### Phase 1-4: HeadModelSelector 구현
1. [ ] `src/agent/HeadModelSelector.ts` 생성
   - `selectHead()`: GPT OAuth 인증 확인 → GPT-5.3-Codex / Claude Opus fallback
   - 기존 `src/lib/gpt/auth.ts`의 `getAuthInfo()` 활용
   - Circuit breaker: 3회 연속 실패 시 대체 모델 전환 (5분 TTL, in-memory Map)
     - **실패 기준**: HTTP 5xx, 네트워크 timeout (>10초), 응답 JSON 파싱 실패
     - **카운터 리셋**: 성공 응답 1회 시 카운터 0으로 리셋
     - **Half-open**: TTL 만료 후 1회 시험 요청 → 성공 시 복구, 실패 시 TTL 재시작
   - File: `src/agent/HeadModelSelector.ts`
   - Verify: `npm test`

### Phase 1-5: ToolRegistry 구현
1. [ ] `src/agent/ToolRegistry.ts` 생성
   - `register(tool)`: Tool 등록
   - `get(name)`: Tool 조회
   - `list()`: 전체 Tool 목록 (JSON Schema 포함)
   - `toOpenAIFormat()`: OpenAI function calling 형식 변환
   - `toAnthropicFormat()`: Anthropic tool use 형식 변환
   - `validate(name, args)`: Zod 스키마로 tool argument 런타임 검증
   - File: `src/agent/ToolRegistry.ts`
   - Verify: `npm test`
</task>

## Constraints
<constraints>
- 기존 `src/lib/gpt/` 코드 구조 유지, 최소 변경 (GPT_MODELS 추가만)
- `any` 타입 금지 → `unknown` + type guards
- 함수 30줄 이내 권장, 50줄 이내 허용
- Nesting 3단계 이내
- zod 의존성 추가 (tool schema 검증용)
- Provider 추상화: GPT/Claude 외 추가 헤드 모델 확장 가능
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/types.ts`
- `src/agent/providers/gpt-head.ts`
- `src/agent/providers/claude-head.ts`
- `src/agent/HeadModelSelector.ts`
- `src/agent/ToolRegistry.ts`

### Files to Modify
- `src/lib/gpt/chat.ts` (GPT_MODELS에 gpt-5.3-codex 추가)
- `package.json` (zod 의존성 추가)

### Verification Commands
- `npm run build`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: GPT OAuth 인증 시 GPT-5.3-Codex가 헤드 모델로 선택된다
- [ ] AC-2: GPT 미인증 시 Claude Opus가 fallback 헤드 모델로 선택된다
- [ ] AC-3: GPT 3회 연속 실패 시 Claude로 자동 전환 (5분 TTL)
- [ ] AC-4: ToolRegistry에 Tool 등록/조회/목록이 동작한다
- [ ] AC-5: Zod 스키마 → OpenAI JSON Schema 변환이 정확하다
- [ ] AC-6: Zod 스키마 → Anthropic input_schema 변환이 정확하다
- [ ] AC-7: HeadModelProvider로 tools 포함 chat 요청이 가능하다
- [ ] AC-8: Tool argument 런타임 검증이 동작한다
- [ ] AC-9: 빌드 성공 (`npm run build`)
- [ ] AC-10: 테스트 통과 (`npm test`)
</acceptance>
