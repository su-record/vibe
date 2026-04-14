---
description: Regression test auto-evolution — register bugs, generate preventive tests, cluster patterns
argument-hint: "register | generate | list | import | cluster [args]"
---

# /vibe.regress

**Regression Auto-Evolution** — never fix the same bug twice.

> Bugs are recorded, preventive tests are generated automatically, and recurring patterns get promoted into shared tests.

## Usage

```
/vibe.regress register "<symptom>"           # Manual register (rare — most calls are automatic)
/vibe.regress generate <slug>                # bug record → vitest file
/vibe.regress list                           # Open items
/vibe.regress import                         # Backfill from git log `fix:` commits
/vibe.regress cluster                        # 3+ similar bugs → propose shared test
```

## Auto-integration

- `/vibe.verify` failure → auto-invokes `register` (no manual step)
- `/vibe.run "<feature>"` start → warns about open regressions for that feature

## Process

Load skill `vibe-regress` with subcommand: `$ARGUMENTS`

The `vibe-regress` skill performs registration, generation, and clustering.

**Core steps** (see `skills/vibe-regress/SKILL.md` for details):

1. Parse subcommand
2. Read/write `.claude/vibe/regressions/<slug>.md` (frontmatter schema enforced)
3. On `generate`, detect the project's test stack → choose template (vitest / jest)
4. On `cluster`, group by `root-cause-tag`; ≥3 entries → propose a shared test
5. On `import`, parse `git log --grep='^fix:'`; skip duplicates by commit hash

## Output

- `.claude/vibe/regressions/<slug>.md` — bug record (frontmatter + reproduction / root cause)
- Project test dir — generated vitest file (`*.regression.test.ts`)
- `list` prints a terminal table

## Storage Format

```markdown
---
slug: login-jwt-expiry-off-by-one
symptom: "JWT expiry cuts off one second early"
root-cause-tag: timezone
fix-commit: abc1234
test-path: src/auth/__tests__/login.regression.test.ts
status: open | test-generated | resolved
registered: 2026-04-14
feature: login
---

## Reproduction
1. ...

## Root cause
...

## Fix
...
```

---

ARGUMENTS: $ARGUMENTS
