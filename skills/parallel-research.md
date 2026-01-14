---
description: Parallel research guide. Auto-activates for complex features, new technologies, security-critical work, architecture design, or technology selection decisions.
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
node -e "import('@su-record/vibe/orchestrator').then(o =>
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
Reflect in SPEC Context section
OR
Reference during implementation
```

## When Research is NOT Needed

- Simple CRUD operations
- Already familiar patterns
- Similar code exists in project
- Time-critical (supplement with review later)

## Notes

- Research runs **after requirements confirmed**
- Split overly broad topics
- Research results are references, not absolute truth
