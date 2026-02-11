---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-07T22:10:00+09:00
lastUpdated: 2026-02-07T22:10:00+09:00
---

# SPEC: ui-ux-pro-max-integration (Master)

## Overview

ui-ux-pro-max-skill 레포의 디자인 인텔리전스 자산(24개 CSV, BM25 엔진, 5단계 디자인 시스템 생성기)을 VIBE 프레임워크에 네이티브 통합하여, `/vibe.spec`, `/vibe.run`, `/vibe.review` 워크플로우 전반에 걸쳐 8개 전문 UI/UX 에이전트를 배치하는 것.

- **Total phases**: 5
- **Dependencies**: `@su-record/core` (현재 프로젝트), ui-ux-pro-max-skill (외부 데이터 소스)

## Sub-SPECs

| Order | SPEC File | Feature File | Status | 예상 파일 수 |
|-------|-----------|--------------|--------|-------------|
| 1 | phase-1-data-engine.md | phase-1-data-engine.feature | ⬜ | 6 |
| 2 | phase-2-spec-agents.md | phase-2-spec-agents.feature | ⬜ | 5 |
| 3 | phase-3-run-agents.md | phase-3-run-agents.feature | ⬜ | 4 |
| 4 | phase-4-review-agents.md | phase-4-review-agents.feature | ⬜ | 5 |
| 5 | phase-5-workflow-integration.md | phase-5-workflow-integration.feature | ⬜ | 4 |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+ / TypeScript 5.5+
- Package: `@su-record/core` v0.1.18
- Test: Vitest 4.0+
- DB: SQLite (better-sqlite3) — 기존 메모리 시스템
- Build: tsc
- Deploy: npm (GitHub Packages)

### Architecture Decisions (리서치 기반)

1. **BM25 TypeScript 자체 구현** — `wink-bm25-text-search` 참고하되, 외부 의존성 없이 순수 TS 구현. NFKC 정규화 + configurable tokenizer pipeline
2. **CSV 파싱**: `papaparse` (브라우저/노드 호환, RFC 4180 준수, BOM 처리)
3. **디자인 토큰 3단계 구조** (Gemini 제안): Primitive → Semantic → Component 레이어
4. **데이터 로딩**: Hot Cache (products + reasoning) + Lazy Load (나머지) + LRU Query Cache
5. **보안**: CSS 토큰 값 escape, hex 코드 정규식 검증, 검색 쿼리 길이/토큰 수 제한
6. **에이전트 아키텍처**: Supervisor-Worker 패턴 — ①산업분석이 supervisor로 분석 결과를 ②③에 전달

### Constraints
- 외부 의존성 최소화 (papaparse 1개만 추가)
- Python 의존성 완전 제거 (TypeScript 포팅)
- 기존 도구 등록 패턴(`src/types/tool.ts`) 준수
- 기존 에이전트 MD 형식(`agents/*.md`) 준수
- CSV 데이터는 `~/.claude/vibe/ui-ux-data/`에 글로벌 배치
- 생성된 디자인 시스템은 `.claude/vibe/design-system/{project}/`에 프로젝트별 저장
