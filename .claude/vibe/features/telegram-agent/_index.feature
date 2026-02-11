# Feature: telegram-agent (Master)

**Master SPEC**: `.claude/vibe/specs/telegram-agent/_index.md`

## Sub-Features

| Order | Feature File | SPEC File | Status |
|-------|--------------|-----------|--------|
| 1 | phase-1-claude-agent.feature | phase-1-claude-agent.md | ⬜ |
| 2 | phase-2-message-router.feature | phase-2-message-router.md | ⬜ |
| 3 | phase-3-task-notifier.feature | phase-3-task-notifier.md | ⬜ |
| 4 | phase-4-bridge-upgrade.feature | phase-4-bridge-upgrade.md | ⬜ |

## Overall User Story

**As a** Vibe 사용자
**I want** 텔레그램에서 8가지 역할을 수행하는 AI 에이전트와 대화
**So that** 개발, 리서치, 시스템 관리, 메모 등을 모바일에서 원격으로 처리할 수 있다

## Total Scenarios: 38
- Phase 1: 10 scenarios (Claude CLI + 시스템 프롬프트)
- Phase 2: 11 scenarios (의도 분류 + 라우팅)
- Phase 3: 10 scenarios (비동기 작업 + 세션)
- Phase 4: 7 scenarios (통합 + 설정)
