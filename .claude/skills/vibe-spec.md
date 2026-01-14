---
# prettier-ignore
description: SPEC-driven development with PTCF structure and parallel research agents. Use when creating specifications, planning features, or starting new development tasks.
---

# VIBE SPEC Skill

Activate this skill when the user wants to:
- Create a new feature specification
- Plan implementation with PTCF structure
- Start SPEC-driven development workflow
- Research best practices for a feature

## Workflow

1. Gather requirements through Q&A
2. Run 4 parallel research agents after requirements are confirmed
3. Generate SPEC document in PTCF format

## PTCF Structure

```
<role>      AI 역할 정의
<context>   배경, 기술 스택, 관련 코드
<task>      Phase별 작업 목록
<constraints> 제약 조건
<output_format> 생성/수정할 파일
<acceptance> 검증 기준
```

## Research Agents

| Agent | Role |
|-------|------|
| best-practices-agent | Best practices for confirmed stack |
| framework-docs-agent | Latest docs via context7 |
| codebase-patterns-agent | Existing pattern analysis |
| security-advisory-agent | Security recommendations |

## Trigger Keywords

- spec, specification, SPEC
- plan, planning, design
- feature request, new feature
- PTCF, requirements
