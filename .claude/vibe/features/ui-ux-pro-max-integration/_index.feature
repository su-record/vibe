# Feature: ui-ux-pro-max-integration (Master)

**Master SPEC**: `.claude/vibe/specs/ui-ux-pro-max-integration/_index.md`

## Sub-Features

| Order | Feature File | SPEC File | Status |
|-------|--------------|-----------|--------|
| 1 | phase-1-data-engine.feature | phase-1-data-engine.md | ⬜ |
| 2 | phase-2-spec-agents.feature | phase-2-spec-agents.md | ⬜ |
| 3 | phase-3-run-agents.feature | phase-3-run-agents.md | ⬜ |
| 4 | phase-4-review-agents.feature | phase-4-review-agents.md | ⬜ |
| 5 | phase-5-workflow-integration.feature | phase-5-workflow-integration.md | ⬜ |

## Overall User Story
**As a** VIBE 프레임워크 사용자
**I want** AI 기반 UI/UX 디자인 인텔리전스가 개발 워크플로우에 자동 통합되기를
**So that** 전문 디자이너 없이도 산업 표준 수준의 UI/UX 품질을 보장받을 수 있다

## End-to-End Flow
```
/vibe.spec "SaaS dashboard"
  → ① 산업 분석 → ② 디자인 시스템 생성 → ③ 레이아웃 설계
  → SPEC에 Design System 섹션 자동 주입

/vibe.run "SaaS dashboard"
  → ④ Next.js 가이드 제공 → ⑤ 차트 추천
  → 구현 에이전트 컨텍스트에 주입

/vibe.review
  → ⑥ UX 가이드라인 검증 → ⑦ 접근성 감사 → ⑧ 안티패턴 탐지
  → 기존 13개 리뷰와 병합
```
