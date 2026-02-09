---
status: done
currentPhase: 4
totalPhases: 4
createdAt: 2026-02-09T05:15:00.000Z
lastUpdated: 2026-02-09T06:55:00.000Z
---

# SPEC: vibe-agent-pipeline-rebuild (Master)

## Overview

Vibe의 외부 메시지(Telegram/Slack/iMessage/Web) → AI 에이전트 → 도구 실행 → 응답 파이프라인을 완전 재구축한다.
현재 상태: 모든 구성요소(AgentLoop, HeadModelSelector, ToolExecutor, PolicyEngine, ConversationState)가 개별적으로 존재하나, **SessionPool.executeRequest() STUB** 로 인해 연결이 끊어져 0% 작동.

- Total phases: 4
- Dependencies: better-sqlite3, node:async_hooks
- Note: zod v4는 Phase 1에서 점진적 제거 (Phase 1 완료 시 package.json에서 삭제)

## Sub-SPECs

| Order | SPEC File | Feature File | Status |
|-------|-----------|--------------|--------|
| 1 | phase-1-pipeline-connection.md | phase-1-pipeline-connection.feature | ✅ |
| 2 | phase-2-gpt-reasoning-policy.md | phase-2-gpt-reasoning-policy.feature | ✅ |
| 3 | phase-3-vision-tools.md | phase-3-vision-tools.feature | ✅ |
| 4 | phase-4-persistence-preflight.md | phase-4-persistence-preflight.feature | ✅ |

## Shared Context

### Tech Stack
- Runtime: Node.js 22+ (ESM, `"type": "module"`)
- Language: TypeScript strict mode
- Database: better-sqlite3 (WAL mode)
- Head Model: GPT 5.3 Codex (primary) → Claude (fallback)
- Tool Schema: JSON Schema direct (Zod 제거 결정)
- Test: Vitest v4.0.16

### Architecture Decision: ToolRegistry 제거
- **결정**: ToolRegistry 클래스를 제거하고 JSON Schema를 도구 정의에 직접 작성
- **근거**: GPT Function Calling은 JSON Schema를 직접 수신. Zod→JSON Schema 변환 레이어는 불필요한 복잡성
- **대안 검토**: Zod 유지(타입 안전성) vs JSON Schema 직접(단순성) → 직접 채택
- **영향**: 12개 도구 파일 수정, ToolRegistry.ts 삭제, ToolExecutor 단순화

### Architecture Decision: telegram-assistant-bridge 패턴 복제
- **결정**: daemon 경로에서도 bridge와 동일하게 AgentLoop를 직접 초기화
- **근거**: bridge(`src/bridge/telegram-assistant-bridge.ts` L160-172)는 유일한 작동 패턴
- **영향**: SessionPool.executeRequest()에서 AgentLoop.process() 직접 호출

### Research Summary (10 parallel tasks)

**GPT Research:**
- 12 architecture patterns (function calling loop, circuit breaker, policy gate)
- 10 anti-patterns (keyword matching, direct tool exec without validation)
- 5 security vulnerabilities (prompt injection, tool escalation, SSRF)

**Gemini Research:**
- Gemini Live WebSocket 패턴 (`wss://generativelanguage.googleapis.com/ws/...`)
- 4 anti-patterns (fake streaming, REST polling disguised as live)
- 3 security advisories (prompt injection, WebSocket hijacking, audio injection)

**Kimi K2.5 Research:**
- 8 code review patterns (idempotency cache, AsyncLocalStorage isolation)
- 8 edge cases (concurrent tool calls, timeout cascading, circular tool deps)
- 8 architecture patterns (event sourcing for conversation, CQRS for tools)

**Claude Agents:**
- Codebase patterns: bridge 작동 패턴 vs daemon STUB 패턴 차이 확인
- Security advisory: 10개 보안 체크리스트 (prompt injection filter, rate limiting 등)
- Framework docs: Gemini Live WebSocket protocol, GPT FC request/response format
- Best practices: WebSocket 보안, SQLite WAL concurrent access

### Timeout Policy (Cross-Phase)
| Scope | Timeout | 적용 위치 |
|-------|---------|-----------|
| 개별 도구 실행 | 30초 | ToolExecutor.execute() |
| AgentLoop 단일 요청 | 60초 | SessionPool.executeRequest() (큐 대기 시간 포함) |
| HeadModel API 호출 | 30초 | HeadModelSelector.select() |
| Preflight 전체 | 2초 | preflight.ts |
| WebSocket 연결 | 10초 | GeminiLive.connect() |

### Observability (Cross-Phase)
- 구조화된 JSON 로깅: requestId, sessionId, toolName, latency, policyResult 포함
- 민감 필드 자동 마스킹: CREDENTIAL_PATTERNS 재사용
- PolicyEngine warn/reject 시 감사 로그 (requestId + 사유)
- 에러 로그: 스택 트레이스 + 컨텍스트 (세션/채널/도구)

### Constraints
- ESM 모듈 (imports에 `.js` 확장자 필수)
- 기존 interface/types.ts의 ExternalMessage 인터페이스 유지
- HeadModelSelector 회로 차단기 로직 변경 금지
- 기존 12개 tool handler 함수 시그니처 유지 (`(args: Record<string, unknown>) => Promise<string>`)
