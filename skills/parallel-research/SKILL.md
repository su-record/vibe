---
name: parallel-research
user-invocable: false
invocation: [auto]
tier: standard
description: "Parallel research with 4 specialized agents (best-practices, framework-docs, codebase-patterns, security-advisory) running simultaneously. Use when facing unfamiliar technology, choosing between libraries/frameworks, designing architecture for a new feature, or investigating security implications. Must use this skill when user asks 'how should we build X', 'which library for Y', or when starting work on a complex feature with unknown requirements. Not for simple lookups — use web search directly for those."
triggers: [parallel research, complex feature, technology selection, architecture design, security critical]
priority: 60
chain-next: [exec-plan]
---
# Parallel Research

Parallel research patterns for solving complex problems.

## When Parallel Research is Needed

| Situation | Reason |
|-----------|--------|
| New technology adoption | Need best practices |
| Security-related features | Multi-angle review needed |
| Architecture design | Multiple perspectives needed |
| Technology selection | Comparison analysis needed |
| Complex bugs | Explore multiple causes |

## Research Lenses (4 Parallel)

| Lens | Role | How |
|-------|------|-----|
| best-practices | Search best practices | native WebSearch (+context7) |
| framework-docs | Search official docs | native WebFetch/context7 |
| codebase-patterns | Analyze existing code patterns | native Explore subagent |
| security-advisory | Search security advisories | native WebSearch |

## Usage

**Spawn the four lenses as concurrent native subagents in a single message** — each lens is blind to the others; synthesize after all return:

```
Task 1 (Explore): "Analyze existing auth code patterns"          (concurrent)
Task 2 (general-purpose): "Search React auth best practices"     (concurrent)
Task 3 (general-purpose): "Search Supabase Auth official docs"   (concurrent)
Task 4 (general-purpose): "Search auth security vulnerabilities" (concurrent)
```

`/vibe.spec "feature-name"` runs this automatically when the SPEC pass needs unfamiliar-technology research.

## Using Research Results

```
Parallel research complete
    ↓
Synthesize results
    ↓
Persist to .vibe/research/<topic-slug>/
    ├── synthesis.md      (conversational report)
    ├── awesome-list.md   (curated links/repos)
    └── paper.md          (structured survey for /vibe.spec Context)
    ↓
Reflect in SPEC Context section
OR
Reference during implementation
```

### Output Location (SSOT)

All research artifacts live under `.vibe/research/<topic-slug>/`. Reference `paper.md` explicitly when writing a SPEC (e.g. paste its path into the Context section). Re-running research on the same topic overwrites unless the slug collides across dates (then `-YYYYMMDD` suffix).

> Wire-up note: `/vibe.spec` does **not** yet auto-scan this directory — that integration is a follow-up. For now, cite the path manually.

Pass `--ephemeral` to skip persistence when exploring throwaway questions.

## When Research is NOT Needed

- Simple CRUD operations
- Already familiar patterns
- Similar code exists in project
- Time-critical (supplement with review later)

## Notes

- Research runs **after requirements confirmed**
- Split overly broad topics
- Research results are references, not absolute truth

## Done Criteria (K4)

- [ ] All 4 research agents returned results (or documented why not)
- [ ] Results synthesized into actionable recommendations
- [ ] Three artifacts written to `.vibe/research/<slug>/` (synthesis / awesome-list / paper) — unless `--ephemeral`
- [ ] Every awesome-list entry has a one-line "why"
- [ ] Key findings reflected in SPEC Context section or implementation notes
- [ ] Conflicting recommendations resolved with reasoning
