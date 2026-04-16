---
description: Self-test vibe — probe every command/skill/hook/agent in the target harness install dir and write a pass/fail report
argument-hint: "[cc|coco]  (empty = current harness)"
---

# /vibe.test

**Vibe Self-Test** — probe every shipped surface (commands, skills, hooks, agents) in a vibe install dir and emit a pass/fail report.

## Usage

```
/vibe.test         # Test current harness (auto-detect)
/vibe.test cc      # Force-test ~/.claude/
/vibe.test coco    # Force-test ~/.coco/
```

No subcommands. No CC-vs-coco comparison semantics. One command, one report.

## Report

Stored in vibe's global dir (not per-project):

```
~/.vibe/test-reports/<YYYYMMDD-HHmm>-<harness>.json
~/.vibe/test-reports/<YYYYMMDD-HHmm>-<harness>.md
```

Markdown summary is also printed to the console when the run finishes.

## Process

Load skill `vibe-test` with target harness: `$ARGUMENTS`

- If `$ARGUMENTS` is empty, detect the current harness (CC vs coco) and use that.
- If the target install dir is missing, exit cleanly with guidance (not an error).

See `skills/vibe-test/SKILL.md` for the probe spec and the report template.

## Done Criteria

- [ ] Runs without any external LLM call — file reads + vitest only
- [ ] A single probe failure never halts the overall run
- [ ] JSON report matches the template in SKILL.md exactly
- [ ] P1 failures auto-register via `/vibe.regress`

---

ARGUMENTS: $ARGUMENTS
