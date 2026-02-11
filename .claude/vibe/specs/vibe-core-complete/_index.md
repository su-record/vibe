---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-06T10:49:09+09:00
lastUpdated: 2026-02-06T10:49:09+09:00
---

# SPEC: vibe-core-complete (Master)

## Overview

Vibe Core를 **AI가 일하게 만드는 운영체제(OS)**로 완성하기 위한 고도화 SPEC.

- **Total Phases**: 5
- **Dependencies**: 기존 vibe 인프라 (orchestrator, tools, hooks, memory)
- **Target**: visee 등 앱이 올라가는 전역 런타임 플랫폼

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-agent-engine.md | phase-1-agent-engine.feature | Agent Engine (상주 데몬) | ⬜ |
| 2 | phase-2-job-order.md | phase-2-job-order.feature | Job/Order 시스템 | ⬜ |
| 3 | phase-3-policy-engine.md | phase-3-policy-engine.feature | Policy Engine | ⬜ |
| 4 | phase-4-external-interface.md | phase-4-external-interface.feature | 외부 인터페이스 (Telegram, Web) | ⬜ |
| 5 | phase-5-sync-portability.md | phase-5-sync-portability.feature | Sync & Portability | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+
- Language: TypeScript (strict mode)
- Database: SQLite (better-sqlite3) - 이미 사용 중
- CLI: Commander.js
- IPC: JSON over stdio (claude --stream-json 모드)

### Existing Infrastructure (래핑 대상)
- `src/orchestrator/`: SmartRouter, LLMCluster, AgentManager, PhasePipeline
- `src/tools/`: 35+ MCP 도구
- `src/lib/memory/`: SessionRAG, KnowledgeGraph
- `hooks/scripts/`: 18+ hooks
- Claude Code CLI: `claude -p --input-format stream-json --output-format stream-json`

### Constraints (전 Phase 공통)
- 기존 인프라 수정 최소화 (래핑 방식)
- 전역 설치 구조 유지 (`~/.vibe/`)
- 프로젝트별 앱은 로컬 폴더에서 실행
- OAuth 인증 흐름 존중 (Claude Code)
- 모든 판단/실행은 증거(Evidence) 남김

### Architecture Principle

```
[External Interface]     [Vibe Core Engine]         [Execution]
                              │
Telegram ─┐                   │
Web UI   ─┼─→ [Agent Engine] ─┼─→ [Job/Order] ─→ [Policy] ─→ [Claude Code]
Voice    ─┘   (상주 데몬)     │       │              │            │
Webhook ─┘                    │       ↓              ↓            ↓
                              │   [ActionPlan]  [Evidence]   [Result]
                              │       │              │            │
                              └───────┴──────────────┴────────────┘
                                      ↓
                              [Memory / Session RAG]
```

## PRD Reference

- PRD 1: Vibe Core 고도화 PRD
- PRD 2: visee PRD (Reference Application)

## Success Criteria (전체)

- [ ] Agent Engine이 백그라운드에서 상주 실행
- [ ] 외부 요청(Telegram, Web)이 Job으로 정규화
- [ ] 모든 실행이 Policy 평가를 거침
- [ ] 모든 판단이 Evidence로 기록됨
- [ ] 세션이 달라도 기억/정책 유지
- [ ] `vibe daemon start/stop/status` CLI 동작
- [ ] Telegram 봇으로 코딩 작업 가능
