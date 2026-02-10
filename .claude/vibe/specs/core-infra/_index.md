---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-09T00:14:38Z
lastUpdated: 2026-02-09T00:14:38Z
---

# SPEC: core-infra (Master)

## Overview

VIBE core(`@su-record/core`) 패키지에 외부 UI 연동을 위한 API Server, Gemini Live Vision 모듈, Slack/iMessage 채널을 추가하는 인프라 확장.

- Total phases: 5
- Dependencies: 기존 `BaseInterface`, `AgentLoop`, `RouteServices` 패턴 위에 구축
- Deadline: 2026-02-20 (해커톤)

## Sub-SPECs

| Order | SPEC File | Feature File | Status |
|-------|-----------|--------------|--------|
| 1 | phase-1-api-server.md | phase-1-api-server.feature | ⬜ |
| 2 | phase-2-vision.md | phase-2-vision.feature | ⬜ |
| 3 | phase-3-slack.md | phase-3-slack.feature | ⬜ |
| 4 | phase-4-imessage.md | phase-4-imessage.feature | ⬜ |
| 5 | phase-5-integration.md | phase-5-integration.feature | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+ (TypeScript, ESM)
- DB: SQLite (better-sqlite3, WAL mode)
- Validation: Zod
- Testing: Vitest
- Existing: `BaseInterface` 추상 클래스 패턴
- 외부 의존성 최소화 (기존 `node:http`, `node:https` 사용)

### Architecture Principles
- `BaseInterface` 확장 패턴 준수 (TelegramBot, WebServer와 동일)
- `ChannelType` 타입에 새 채널 추가
- `ExternalMessage`/`ExternalResponse` 공통 메시지 규격 사용
- AsyncLocalStorage 기반 요청 스코프 격리
- 외부 라이브러리 최소화 (가능하면 Node.js 내장 모듈)
- 로컬 설치 + 클라우드 SaaS 모두 지원하는 이중 배포 구조
- `package.json`에 `"./agent"` export 추가

### Constraints
- 기존 코드 패턴 준수 (no Express, no Fastify — 이미 `node:http` 사용)
- `any` 타입 금지 → `unknown` + type guards
- 함수 ≤30줄 (권장), ≤50줄 (허용)
- 중첩 ≤3단계
- 환경변수로 설정 분리
- 에러 메시지 한국어 기본

### Research Summary (6 LLM + 2 Claude Agent)
- **GPT**: Layered architecture, channel abstraction interface, backpressure-aware streaming, idempotency keys
- **Gemini**: AsyncLocalStorage 활용, AI stream tunneling (ReadableStream pipe), BlueBubbles API for iMessage
- **Kimi**: Circuit breaker pattern, structured concurrency (AbortController), Worker Threads for vision preprocessing
- **Security**: AppleScript command injection 방지, Slack OAuth state validation, SSE/WS auth on upgrade, SSRF 방지, Gemini prompt injection 주의
