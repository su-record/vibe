---
status: pending
currentPhase: 0
totalPhases: 8
createdAt: 2026-02-11T00:00:00.000Z
lastUpdated: 2026-02-11T00:00:00.000Z
---

# SPEC: sonolbot-patterns (Master)

## Overview

소놀봇(`mybot_ver2`)에서 검증된 7가지 운영 패턴을 Vibe(`@su-record/core`) 프레임워크에 도입하고, 12flow-write 기반 응답 텍스트 스타일을 적용한다.

- **Total phases:** 8
- **Estimated files to modify:** 18
- **Dependencies (canonical DAG):**
  - Phase 1 (Timeout) — no deps
  - Phase 2 (File Attachment) — depends: Phase 1
  - Phase 3 (Batching) — depends: Phase 2
  - Phase 4 (Injection) — depends: Phase 3
  - Phase 5 (History) — depends: Phase 4
  - Phase 6 (Pre-Check) — depends: Phase 4 (pendingInstructions interface)
  - Phase 7 (Response Style) — independent
  - Phase 8 (Config) — depends: Phase 1, 2, 3, 4, 5, 7 (final consolidation)

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-activity-timeout.md | phase-1-activity-timeout.feature | Activity-Based Timeout + Dual-Layer Lock | ⬜ |
| 2 | phase-2-file-attachment.md | phase-2-file-attachment.feature | File Attachment Support (사진/문서/영상/음성/GPS) | ⬜ |
| 3 | phase-3-message-batching.md | phase-3-message-batching.feature | Multi-Message Batching | ⬜ |
| 4 | phase-4-mid-task-injection.md | phase-4-mid-task-injection.feature | Mid-Task Instruction Injection | ⬜ |
| 5 | phase-5-conversation-history.md | phase-5-conversation-history.feature | 24h Raw Conversation History | ⬜ |
| 6 | phase-6-quick-precheck.md | phase-6-quick-precheck.feature | Quick Pre-Check | ⬜ |
| 7 | phase-7-response-style.md | phase-7-response-style.feature | Response Text Style (12flow-write) | ⬜ |
| 8 | phase-8-config-integration.md | phase-8-config-integration.feature | Config Integration + Constants | ⬜ |

## Shared Context

### Tech Stack
- Language: TypeScript 5.5+
- Runtime: Node.js >= 18
- Framework: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- Database: SQLite (better-sqlite3, WAL mode)
- Channels: Telegram Bot API, Slack Web API (Socket Mode), WebServer (SSE)

### Source Reference
- 소놀봇: `c:/Users/endba/WorkSpace/mybot_ver2(소놀봇_클로드용)/`
- 12flow-write: `c:/Users/endba/WorkSpace/12flow-write/`

### Constraints
- 기존 API 하위 호환성 유지 (ExternalMessage 확장은 optional 필드만)
- 기존 테스트 깨뜨리지 않기 (better-sqlite3 관련 실패는 기존 이슈)
- TypeScript strict mode 준수 (`any` 금지, 명시적 리턴 타입)
- 함수 길이 50줄 이내, 중첩 3단계 이내

### Research Findings (GPT + Kimi)

**Architecture Patterns (GPT):**
- Sliding activity timeout with tiered deadlines (inactivityTimeout + stepTimeout + absoluteSessionTTL)
- AbortSignal 전파: 모든 async 경계에 AbortSignal propagate
- Windowed batching: debounceWindowMs + maxWaitMs + maxItems, semantic flush triggers
- Instruction layering: platformPolicy > workflowPolicy > taskPlan > userPreference 우선순위
- Attachment ingestion pipeline: accept → validate MIME/signature → persist → async extract → notify
- Style profile as typed policy: StyleProfile 스키마 → prompt block + output validator

**Security (GPT):**
- FILE-002: Path traversal 방지 — 파일명 sanitize, `..` 차단, UUID 파일명 사용
- FILE-001: Magic bytes 검증 (확장자만 신뢰 금지), 파일 크기 제한
- LOC-001: GPS 데이터 최소 수집, 로그에 원시 좌표 금지, 암호화
- TIMEOUT-001: 의미 있는 사용자 활동만 activity refresh (백그라운드 핑 제외)
- EXT-003: SSRF 방지 — outbound URL allowlist, private IP 차단

**Edge Cases (Kimi):**
- Zero-time debounce → setImmediate 사용, 최소 debounce > 0
- Batch size limit hit during flush → atomic swap 후 async 처리
- Activity burst at timeout boundary → 타임스탬프 비교는 timeout callback 내부에서
- File descriptor exhaustion → 세마포어로 동시 open 파일 수 제한
- Timer precision degradation → process.hrtime.bigint() 사용 고려

**Test Strategies (Kimi):**
- Deterministic timer control (vitest fake timers)
- Fault injection (네트워크 timeout at 1%/50%/99%)
- Concurrency stress testing (1000+ 동시 작업)
- Property-based testing (fast-check: 입력 수 <= 출력 수)
