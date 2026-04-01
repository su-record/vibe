---
status: pending
currentPhase: 0
totalPhases: 3
createdAt: 2026-03-31T14:23:56+09:00
lastUpdated: 2026-03-31T14:23:56+09:00
---

# SPEC: design-integration (Master)

## Overview

- Total phases: 3
- Feature: impeccable 디자인 시스템에서 영감을 받아 vibe에 디자인 steering skills, deep reference 가이드, design context gathering 기능을 추가
- Dependencies: 기존 `ui-ux-pro-max` skill, `ui-antipattern-detector` agent, `constants.ts` STACK_TO_SKILLS 매핑

## Sub-SPECs

| Order | SPEC File | Feature File | Status |
|-------|-----------|--------------|--------|
| 1 | phase-1-steering-skills.md | phase-1-steering-skills.feature | ✅ |
| 2 | phase-2-design-references.md | phase-2-design-references.feature | ✅ |
| 3 | phase-3-context-workflow.md | phase-3-context-workflow.feature | ✅ |

## Shared Context

### Tech Stack
- TypeScript (ESM, strict mode)
- Build: `tsc` → `dist/`
- Test: `vitest`
- Skills: YAML frontmatter + Markdown body → `skills/{name}/SKILL.md`
- Agents: Markdown → `agents/ui/{name}.md`
- Config: `src/cli/postinstall/constants.ts` (single source of truth)

### Constraints
- `.js` extension in all imports (ESM)
- No `any`, no `as any`, no `@ts-ignore`
- Explicit return types on all functions
- Functions ≤50 lines, nesting ≤3 levels
- 콘텐츠는 영감만 (impeccable에서 재작성, 라이선스 이슈 없음)
- `design-` 접두사 네이밍 컨벤션
- 기존 `ui-ux-pro-max` skill 구조 보존

### Design Decisions
- **Skill vs Agent**: Steering commands는 Skill (사용자 직접 호출이 핵심)
- **Reference 위치**: `skills/ui-ux-pro-max/reference/` (기존 skill 확장)
- **Context 저장**: `.claude/vibe/design-context.json` (vibe config 디렉토리 내)
- **AI Slop 데이터**: `ui-antipattern-detector` agent에 구체적 패턴 추가
- **설치 방식**: `STACK_TO_SKILLS`에 web frontend 스택 연결 + postinstall 자동 배포
