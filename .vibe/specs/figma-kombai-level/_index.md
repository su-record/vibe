---
status: completed
currentPhase: 4
totalPhases: 4
createdAt: 2026-04-07T00:00:00Z
lastUpdated: 2026-04-07T00:00:00Z
---

# SPEC: figma-kombai-level (Master)

> vibe.figma를 Kombai 수준으로 개선 — 4가지 핵심 갭 해소

## Overview

- Total phases: 4
- Dependencies: 기존 vibe.figma 파이프라인 (Phase 0~4), `src/infra/lib/figma/`, `src/infra/lib/browser/`
- 목표: Figma→코드 변환 품질을 Kombai AI Agent 수준으로 끌어올림

## Sub-SPECs

| Order | SPEC File | Feature File | Status |
|-------|-----------|--------------|--------|
| 1 | phase-1-component-reuse.md | phase-1-component-reuse.feature | ✅ |
| 2 | phase-2-compile-feedback.md | phase-2-compile-feedback.feature | ✅ |
| 3 | phase-3-design-token-mapping.md | phase-3-design-token-mapping.feature | ✅ |
| 4 | phase-4-multi-frame.md | phase-4-multi-frame.feature | ✅ |

## Shared Context

### Tech Stack
- TypeScript strict mode, ESM only (`.js` 확장자)
- `vitest` 테스트, `tsc` 빌드
- 스킬 정의: Markdown (YAML frontmatter)
- 인프라: `src/infra/lib/figma/`, `src/infra/lib/browser/`
- 훅 스크립트: `hooks/scripts/figma-extract.js`

### Constraints
- 기존 스킬 파일 수정 우선, 새 파일 최소화
- vibe 철학 유지: "스크린샷 = 정답, Figma 데이터 = 재료"
- 에디터가 아닌 CLI 도구 — 브라우저 편집 기능 없음
- ESM import에 `.js` 확장자 필수
- No `any` — `unknown` + type guards
- 함수 50줄, 중첩 3단계, 파라미터 5개 이하
- `/tmp/{feature}/` 경로 보안 (전 Phase 공통): feature명에서 `/`, `..`, 특수문자 제거, 최대 64자, resolved path가 `/tmp/` 하위인지 검증, 기존 파일 덮어쓰기 허용 (symlink은 거부)

### Architecture Decision
- Kombai의 Context Graphs 개념 참고하되, vector DB 없이 Grep + Glob + Read 기반 경량 인덱싱 (AST 파서 라이브러리 없음)
- 기존 Phase 4 검증 루프에 컴파일 에러 피드백을 추가 (별도 Phase 아님)
- 디자인 토큰 매핑은 Phase 2 재료 확보 시점에 기존 프로젝트 토큰 스캔 추가
- 멀티 프레임은 Phase 2 재료 확보를 여러 URL 동시 처리로 확장
