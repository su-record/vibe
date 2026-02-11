---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-11T00:00:00.000Z
lastUpdated: 2026-02-11T00:00:00.000Z
---

# SPEC: sonolbot-v2 — 텔레그램 에이전트 고도화

## Overview

소놀봇(`mybot_ver2`)에서 검증된 운영 패턴을 Vibe 텔레그램 에이전트 파이프라인에 도입한다.
현재 코드 분석 결과 이미 구현된 부분은 제외하고, 실제 필요한 5개 기능을 구현한다.

- **Total phases:** 5
- **Estimated files to modify/create:** 12
- **Target:** `telegram-assistant-bridge.ts` → `ModelARouter` → `AgentLoop` (GPT head)

## Already Implemented (건드리지 않음)

| 기능 | 위치 |
|------|------|
| FileAttachment / LocationInfo 타입 | `src/interface/types.ts` |
| Telegram 파일 다운로드 + 로컬 저장 | `TelegramBot.ts:269-300` |
| MediaPreprocessor (voice STT, photo Vision) | `MediaPreprocessor.ts` |
| BaseInterface 2s debounce + max 20 batch | `BaseInterface.ts` |
| batchedFrom, allTimestamps 필드 | `types.ts` |
| ConversationStore 사용자/봇 응답 저장 | `AgentLoop.ts:221-224, 386-389` |
| 24h 대화 이력 system prompt 주입 | `AgentLoop.ts:349-356` |
| AgentProgressEvent 시스템 | `AgentLoop.ts:593-599` |

## Dependencies

```
Phase 1 (Progress) ─── independent
Phase 2 (Mid-Task) ─── independent
Phase 3 (Heartbeat) ── depends: Phase 1
Phase 4 (Style) ────── independent
Phase 5 (Config) ───── depends: Phase 1, 2, 3, 4
```

**병렬 가능:** Phase 1 + 2 + 4 동시 작업

## Sub-SPECs

| # | SPEC File | Feature File | Description | Status |
|---|-----------|--------------|-------------|--------|
| 1 | phase-1-progress-reporting.md | phase-1-progress-reporting.feature | 실시간 진행률 Telegram 전송 (editMessage + onProgress) | ⬜ |
| 2 | phase-2-mid-task-injection.md | phase-2-mid-task-injection.feature | 작업 중 새 메시지 큐잉 + AgentLoop 주입 | ⬜ |
| 3 | phase-3-activity-heartbeat.md | phase-3-activity-heartbeat.feature | Activity 기반 timeout + 이중 잠금 | ⬜ |
| 4 | phase-4-response-style.md | phase-4-response-style.feature | 외부 채널 응답 스타일 (text + 이모지) | ⬜ |
| 5 | phase-5-config-cleanup.md | phase-5-config-cleanup.feature | 상수 통합 + config 스키마 + 레거시 삭제 | ⬜ |

## Target Architecture

```
사용자 (Telegram) → TelegramBot → telegram-assistant-bridge.ts
  → ModelARouter.handleMessage()
    → AgentLoop.process() (GPT head via HeadModelSelector)
      → MediaPreprocessor (Gemini Vision/STT)
      → HeadModel.chat() (GPT-5.3-Codex / Claude Opus fallback)
      → Tool execution (DevRoute → ClaudeCodeBridge 등)
    → sendResponse() → TelegramBot → 사용자
```

## Constraints (All Phases)

- 기존 API 하위 호환성 유지
- 기존 테스트 깨뜨리지 않기
- TypeScript strict mode (`any` 금지, 명시적 리턴 타입)
- 함수 50줄 이내, 중첩 3단계 이내
- ESM imports (`.js` 확장자 필수)
