---
name: parallel-research
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

## Research Agents (4 Parallel)

| Agent | Role | Tools |
|-------|------|-------|
| best-practices | Search best practices | Web Search, context7 |
| framework-docs | Search official docs | context7 |
| codebase-patterns | Analyze existing code patterns | Grep, Glob |
| security-advisory | Search security advisories | Web Search |

## Usage Methods

### Method 1: Direct Orchestrator Call

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/infra/orchestrator/index.js').then(o =>
  o.research('passkey authentication', ['React', 'Supabase'])
  .then(r => console.log(r.content[0].text))
)"
```

### Method 2: Use /vibe.spec

```
/vibe.spec "feature-name"
→ Parallel research runs automatically after requirements confirmed
```

### Method 3: Parallel Task Tool Execution

```
Task 1: "Search React auth best practices"
Task 2: "Search Supabase Auth official docs" (concurrent)
Task 3: "Analyze existing auth code patterns" (concurrent)
Task 4: "Search auth security vulnerabilities" (concurrent)
```

## Using Research Results

```
Parallel research complete
    ↓
Synthesize results
    ↓
Persist to .claude/vibe/research/<topic-slug>/
    ├── synthesis.md      (conversational report)
    ├── awesome-list.md   (curated links/repos)
    └── paper.md          (structured survey for /vibe.spec Context)
    ↓
Reflect in SPEC Context section
OR
Reference during implementation
```

### Output Location (SSOT)

All research artifacts live under `.claude/vibe/research/<topic-slug>/`. Reference `paper.md` explicitly when writing a SPEC (e.g. paste its path into the Context section). Re-running research on the same topic overwrites unless the slug collides across dates (then `-YYYYMMDD` suffix).

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
- [ ] Three artifacts written to `.claude/vibe/research/<slug>/` (synthesis / awesome-list / paper) — unless `--ephemeral`
- [ ] Every awesome-list entry has a one-line "why"
- [ ] Key findings reflected in SPEC Context section or implementation notes
- [ ] Conflicting recommendations resolved with reasoning
