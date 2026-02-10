# Feature: sonolbot-patterns (Master)

**Master SPEC**: `.claude/vibe/specs/sonolbot-patterns/_index.md`

## Sub-Features

| Order | Feature File | SPEC File | Description | Status |
|-------|--------------|-----------|-------------|--------|
| 1 | phase-1-activity-timeout.feature | phase-1-activity-timeout.md | Activity-Based Timeout + Dual-Layer Lock | ⬜ |
| 2 | phase-2-file-attachment.feature | phase-2-file-attachment.md | File Attachment Support | ⬜ |
| 3 | phase-3-message-batching.feature | phase-3-message-batching.md | Multi-Message Batching | ⬜ |
| 4 | phase-4-mid-task-injection.feature | phase-4-mid-task-injection.md | Mid-Task Instruction Injection | ⬜ |
| 5 | phase-5-conversation-history.feature | phase-5-conversation-history.md | 24h Raw Conversation History | ⬜ |
| 6 | phase-6-quick-precheck.feature | phase-6-quick-precheck.md | Quick Pre-Check | ⬜ |
| 7 | phase-7-response-style.feature | phase-7-response-style.md | Response Text Style (12flow-write) | ⬜ |
| 8 | phase-8-config-integration.feature | phase-8-config-integration.md | Config Integration + Constants | ⬜ |

## Overall User Story

**As a** Vibe 프레임워크를 통해 Telegram/Slack/Web 채널로 서비스하는 AI 에이전트 운영자
**I want** 소놀봇에서 검증된 7가지 운영 패턴과 12flow-write 기반 응답 스타일을 적용
**So that** 에이전트 안정성(stale 감지), 사용자 경험(배치, 파일, 대화이력), 응답 가독성이 향상됨

## Implementation Order

```
Phase 1 (Timeout) → Phase 6 (Pre-Check) → Phase 2 (File Attachment)
    → Phase 3 (Batching) → Phase 5 (History)
Phase 4 (Injection) — depends on Phase 3
Phase 7 (Response Style) — independent
Phase 8 (Config) — final consolidation
```
