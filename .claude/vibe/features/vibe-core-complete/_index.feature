# Feature: vibe-core-complete (Master)

**Master SPEC**: `.claude/vibe/specs/vibe-core-complete/_index.md`

## Sub-Features

| Order | Feature File | SPEC File | Status |
|-------|--------------|-----------|--------|
| 1 | phase-1-agent-engine.feature | phase-1-agent-engine.md | ⬜ |
| 2 | phase-2-job-order.feature | phase-2-job-order.md | ⬜ |
| 3 | phase-3-policy-engine.feature | phase-3-policy-engine.md | ⬜ |
| 4 | phase-4-external-interface.feature | phase-4-external-interface.md | ⬜ |
| 5 | phase-5-sync-portability.feature | phase-5-sync-portability.md | ⬜ |

## Overall User Story

**As a** developer using Vibe
**I want** Vibe Core to be a complete AI-driven development OS
**So that** I can receive coding requests from any interface (terminal, Telegram, web) and have them processed with consistent quality, policy enforcement, and memory persistence

## Success Criteria

- Agent Engine runs as a background daemon
- All external requests are normalized as Jobs
- Every execution passes Policy evaluation
- All decisions are recorded as Evidence
- Memory and policies persist across sessions
- CLI commands work: `vibe daemon`, `vibe job`, `vibe policy`, `vibe telegram`, `vibe sync`
