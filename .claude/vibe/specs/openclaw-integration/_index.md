---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-05T01:17:05Z
lastUpdated: 2026-02-05T01:17:05Z
---

# SPEC: openclaw-integration (Master)

## Overview

OpenClaw 프로젝트의 핵심 패턴을 Vibe에 통합하여 **4-LLM 멀티 오케스트레이션** 체계를 구축한다. (Claude + GPT + Gemini + Kimi)

- Total phases: 5
- Estimated new files: 15
- Estimated modified files: 30
- Estimated LOC: ~1,800

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-foundation.md | phase-1-foundation.feature | Token Refresh + File Lock, Gemini CLI Auth | ⬜ |
| 2 | phase-2-providers.md | phase-2-providers.feature | Kimi/Moonshot Provider (API Key) | ⬜ |
| 3 | phase-3-orchestrator.md | phase-3-orchestrator.feature | SmartRouter 4-LLM, Auth Profile Rotation | ⬜ |
| 4 | phase-4-agents.md | phase-4-agents.feature | Subagent Announce Pattern, Disk Persistent Registry | ⬜ |
| 5 | phase-5-skills.md | phase-5-skills.feature | Skill Progressive Disclosure, Auto-Install | ⬜ |

## Shared Context

### Tech Stack
- Language: TypeScript (strict, no `any`)
- Runtime: Node.js (ESM)
- Build: tsc → dist/
- Test: Vitest
- Database: better-sqlite3 (for persistence features)
- Package: npm (published as `@su-record/core`)

### Constraints (All Phases)
- 기존 GPT/Gemini 인증 흐름을 깨뜨리지 않음 (backward compatible)
- 모든 새 프로바이더는 OpenAI-compatible API 우선 재사용
- 파일 권한 0o600 유지 (토큰/키 저장)
- `any` 타입 사용 금지 → `unknown` + type guard
- 함수 길이 ≤50 lines, 중첩 ≤3 levels, 파라미터 ≤5
- console.log 금지 (커밋 시)

### Dependencies
- Phase 2는 Phase 1의 TokenRefresher 패턴 사용
- Phase 3은 Phase 2의 kimi 모듈 필요
- Phase 4는 독립 (BackgroundManager만 의존)
- Phase 5는 독립 (skill-injector.js만 의존)

### Research Summary (Claude + GPT + Gemini 병렬 분석 결과)

**OpenClaw에서 가져올 패턴:**
1. Auth Profile Rotation — cooldown 기반 순환, file locking
3. Progressive Disclosure — metadata → body → resources 3계층
4. Subagent Announce — 완료 시 자동 통보 + 통계 수집
5. Plugin Provider 시스템 — 확장 가능한 프로바이더 등록

**Moonshot/Kimi API 특성:**
- OpenAI-compatible endpoint (`/v1/chat/completions`)
- 모델: kimi-k2.5 (256K ctx), kimi-k2-thinking (reasoning)
- 비용: 0 (무료 티어)
- 인증: API Key only (`MOONSHOT_API_KEY`)
- Base URL: `https://api.moonshot.cn/v1` (CN) / `https://api.moonshot.ai/v1` (Global)

