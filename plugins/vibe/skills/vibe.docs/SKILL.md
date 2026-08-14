---
name: vibe.docs
description: Use when README, guides, architecture, release notes, agent instructions, diagrams, or codemaps must be generated or synchronized with the actual codebase.
argument-hint: "readme, guide, arch, release, agent, diagram, or codemaps"
user-invocable: true
---

# /vibe.docs

Generate or update project documentation by analyzing the actual codebase.

## Usage

```
/vibe.docs readme     # README.md 생성/갱신
/vibe.docs guide      # 사용자 가이드 (docs/GUIDE.md)
/vibe.docs arch       # 아키텍처 문서 + Mermaid 다이어그램 (docs/ARCHITECTURE.md)
/vibe.docs release    # 릴리즈 노트 (git history 기반)
/vibe.docs agent      # CLAUDE.md / AGENTS.md 생성·동기화 (agents-md 검증 필수)
/vibe.docs diagram    # Mermaid 다이어그램 (architecture/ER/flow/seq) → .vibe/diagrams/
/vibe.docs codemaps   # 코드베이스 구조 자동 문서화 → docs/CODEMAPS/
```

## Pipeline Position

```
/vibe.spec    → Design (what to build)
/vibe.run     → Implement (build it)
/vibe.trace   → Verify (prove it works)
/vibe.docs    → Document (explain it)
```

---

Execute the bundled implementation below — subcommand에 따라 해당 섹션 실행

ARGUMENTS: $ARGUMENTS

## Bundled implementation


# vibe.docs — Project Documentation Generator

Generate or update project documentation by analyzing the actual codebase.

## Subcommands

## Subcommands (선택된 하나만 로드)

한 번의 호출은 서브커맨드 **하나만** 실행한다. 해당 reference 하나만 읽고 나머지 6개는 읽지 않는다.

| 서브커맨드 | 산출물 | 본문 |
|---|---|---|
| `readme` | README.md | `references/readme.md` |
| `guide` | 사용자 가이드 | `references/guide.md` |
| `arch` | 아키텍처 문서 | `references/arch.md` |
| `agent` | CLAUDE.md / AGENTS.md | `references/agent.md` |
| `release` | 릴리스 노트 / CHANGELOG | `references/release.md` |
| `diagram` | 다이어그램 | `references/diagram.md` |
| `codemaps` | 코드맵 | `references/codemaps.md` |

서브커맨드 없이 호출되면 무엇을 생성할지 사용자에게 묻는다 — 전부 생성하지 않는다.

## Pipeline Integration

`/vibe.docs` completes the development pipeline:

```
/vibe.spec    → Design (what to build)
/vibe.run     → Implement (build it)
/vibe.trace   → Verify (prove it works)
/vibe.docs    → Document (explain it)
```

### Auto-trigger after `/vibe.trace`

When `/vibe.trace` completes with all scenarios passing, suggest:
> "All scenarios verified. Run `/vibe.docs readme` to update documentation?"

## Guidelines

### DO
- Read the actual codebase before generating — never guess
- Preserve existing documentation that's still accurate
- Include concrete code examples from the actual project
- Keep language consistent with project (Korean/English based on CLAUDE.md)
- For `/vibe.docs release` (changelog mode), follow `references/api-docs-changelog.md` natively — no dedicated agent
- For API-heavy projects (api-docs mode), follow `references/api-docs-changelog.md` natively
- For `/vibe.docs arch` and `/vibe.docs diagram` Mermaid generation, follow `references/diagram-spec.md` natively
- Use the `agents-md` skill for `/vibe.docs agent` — applies equally to CLAUDE.md and AGENTS.md

### DON'T
- Don't generate placeholder text ("Lorem ipsum", "TODO: fill in")
- Don't document internal implementation details in user-facing docs
- Don't create files without reading existing ones first
- Don't assume features — verify by reading code

## Quality Checklist

Before finalizing any document:

- [ ] All code examples are runnable (copy-paste ready)
- [ ] Installation steps tested against package.json
- [ ] Links and paths are valid
- [ ] No placeholder text remaining
- [ ] Consistent with project language (Korean/English)

## Done Criteria

- [ ] The requested document exists at its specified path.
- [ ] Example commands, paths, and identifiers match the repository.
- [ ] No placeholder or unverified feature claim remains.
- [ ] Internal links and file paths resolve to real targets.
- [ ] The document preserves the project's existing language.

## 체인 의존 (reference 안에서 호출되는 스킬)

reference 로 내려간 절차가 다른 스킬을 체인 호출한다. **설치 무결성 검사가 추적할 수 있도록 여기에 선언한다** —
선언이 없으면 그 스킬이 미설치여도 아무도 잡지 못한다.

- Load skill `vibe.agents-md` — `references/agent.md` 단계에서 호출
