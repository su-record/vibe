---
status: pending
currentPhase: 0
totalPhases: 6
createdAt: 2026-02-08T09:30:00+09:00
lastUpdated: 2026-02-08T09:30:00+09:00
---

# SPEC: vibe-agent (Master)

## Overview

VIBE를 코드 기반 메시지 라우터에서 **LLM function calling 기반 개인 에이전트**로 전환한다.

- Total phases: 6
- Estimated files: 20+
- Dependencies: GPT OAuth, Gemini OAuth, AZ API Key, Telegram Bot API

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-head-model.md | phase-1-head-model.feature | 헤드 모델 선택 및 Tool Registry | ⬜ |
| 2 | phase-2-agent-core.md | phase-2-agent-core.feature | Agent Loop (ModelARouter 교체) | ⬜ |
| 3 | phase-3-tool-definitions.md | phase-3-tool-definitions.feature | Function Calling Tool 정의 | ⬜ |
| 4 | phase-4-async-jobs.md | phase-4-async-jobs.feature | 비동기 Job 시스템 확장 | ⬜ |
| 5 | phase-5-voice-flow.md | phase-5-voice-flow.feature | 음성 플로우 통합 | ⬜ |
| 6 | phase-6-migration.md | phase-6-migration.feature | 마이그레이션 및 테스트 | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+ / TypeScript 5.5+
- Database: SQLite (better-sqlite3, WAL mode)
- Bot: Telegram Bot API (webhook)
- LLMs: GPT-5.3-Codex (OAuth), Claude Opus 4.6, Gemini 3 Flash (OAuth), Kimi K2.5 (AZ API Key)
- Test: Vitest
- Build: tsc

### Architecture Decision

**현재 (교체 대상)**:
```
Telegram → ModelARouter → IntentClassifier (keyword/prefix) → RouteRegistry → Route.execute()
```

**목표 (새 아키텍처)**:
```
Telegram → AgentLoop → HeadModel.chat(tools) → function_call → ToolExecutor → result → HeadModel → response
```

### Head Model Priority
1. GPT OAuth 인증 있음 → **GPT-5.3-Codex** (function calling 최적)
2. GPT 미인증 → **Claude Opus 4.6** (fallback)

### Constraints
- 기존 GPT/Gemini/AZ 통합 코드 (`src/lib/`) 유지
- SmartRouter (`src/orchestrator/SmartRouter.ts`) 유지 (tool 내부에서 사용)
- BackgroundManager (`src/orchestrator/BackgroundManager.ts`) 유지/확장
- MCP Tools (35+) 유지
- 기존 Telegram 메시지 타입/인터페이스 유지

### Performance Targets
- 단순 텍스트 응답: < 3초 (HeadModel 1회 호출)
- Tool call 포함 응답: < 10초 (tool 실행 시간 제외)
- HeadModel 1회 호출 latency budget: < 2초

### Security Requirements
- Telegram webhook secret token 검증 필수
- Tool 감사 로그: `{ timestamp, toolName, args (마스킹), latencyMs, success }`
- Per-tool 권한 scope: read / write / execute
- SSRF 차단: private IP (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)

### Research Summary

**Best Practices (GPT + Gemini + Kimi 합의)**:
- Zod 기반 타입 안전 Tool 스키마 → JSON Schema 자동 생성
- Provider-agnostic Tool 추상화 (OpenAI/Anthropic/Gemini 호환)
- Circuit Breaker + Fallback Chain (opossum 패턴)
- Tool 실행 샌드박싱 (worker_threads, AbortController, 30s timeout)
- 대화 상태: 단기 컨텍스트 + 장기 메모리 분리
- Idempotency Key로 중복 tool call 방지
- Streaming function call 감지 및 점진적 처리

**Security (GPT + Gemini 합의)**:
- Prompt injection 방지: 사용자 입력과 tool 출력 분리, 명시적 delimiter
- Tool allowlist + per-tool scope + least privilege
- Zod strict parsing으로 tool argument 검증
- Telegram webhook secret token + IP allowlist
- 비밀키 로그/프롬프트 노출 금지
- SSRF 방지: outbound domain allowlist
- Tool call 감사 로깅

**Architecture (Kimi 분석)**:
- Strangler Fig 패턴: 점진적 마이그레이션 (키워드 매칭 → LLM 라우팅)
- Multi-Tier Routing: 고확신 키워드는 즉시 라우팅 (<10ms), 모호한 쿼리만 LLM (200-800ms)
- Shadow Mode: 30일 병렬 실행으로 정확도 검증 후 전환
- Temperature=0 for tool selection (결정론적 라우팅)
