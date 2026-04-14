---
description: Self-test vibe across CC and coco — verify every command/skill/hook/agent/tool is callable and behaves identically
argument-hint: "parity | report | compare [args]"
---

# /vibe.test

**Vibe Self-Test** — verify vibe works identically in both Claude Code and coco.

> Catch features broken on one harness before users do.

## Usage

```
/vibe.test parity                              # Static parity (file set + content sync) — local, fast
/vibe.test report                              # Invoke every feature in current harness, write JSON+MD report
/vibe.test compare <cc-report> <coco-report>   # Diff two reports, classify P1/P2/P3
```

## Key Constraint

`/vibe.test report` only tests the **harness it runs in**. Run from CC for CC results, run from coco for coco results. Then `compare` merges them.

```
[CC]   /vibe.test report → .claude/vibe/test-reports/<ts>-cc.{json,md}
[coco] /vibe.test report → .coco/vibe/test-reports/<ts>-coco.{json,md}
[any]  /vibe.test compare → diff with parity findings
```

## Subcommand: parity (static check, stage 1)

No harness execution — file system comparison only:

| Check | Compared |
|---|---|
| **install set** | `~/.claude/{commands,skills,agents}/` vs `~/.coco/{commands,skills,agents}/` file set |
| **content sync** | `CLAUDE.md` ↔ `AGENTS.md` body (excluding header/meta blocks) |
| **path config** | `.claude/vibe/` vs `.coco/vibe/` directory layout |
| **doc references** | Paths cited in CLAUDE.md/AGENTS.md actually resolve in install dir |

**Output**: console table + `.claude/vibe/test-reports/<ts>-parity.json`

This stage alone catches:
- New commands missing on one harness (e.g. if `/vibe.regress` had been added only to CC)
- AGENTS.md holding stale paths (e.g. `.codex/` references after a coco rename)
- CLAUDE.md ↔ AGENTS.md body drift

## Subcommand: report (runtime invocation)

Probes every shipped feature in the current harness and writes a JSON+MD report.

| Category | Probe |
|---|---|
| commands | frontmatter validity, body delegates to a skill |
| skills | frontmatter validity, triggers non-empty |
| hooks | run matching vitest suite |
| agents | frontmatter validity, declared tools exist in harness |
| tools | run matching vitest suite or smoke-call with minimal input |

No external LLM calls. Interactive commands are not actually invoked — structural validation only. See `skills/vibe-test/SKILL.md` for full probe spec and failure-handling rules.

## Subcommand: compare (diff two reports)

Compare two JSON reports and classify findings:
- **P1**: feature exists on only one side → missing
- **P2**: both sides have it but response shape differs → behavioral drift
- **P3**: only message wording differs, semantics identical → informational

P1 findings auto-invoke `/vibe.regress register --from-test`.

## Process

Load skill `vibe-test` with subcommand: `$ARGUMENTS`

See `skills/vibe-test/SKILL.md` for detailed logic.

## Storage

```
.claude/vibe/test-reports/   (CC side)
.coco/vibe/test-reports/     (coco side)
  <YYYYMMDD-HHmm>-<harness>.json
  <YYYYMMDD-HHmm>-<harness>.md
  <YYYYMMDD-HHmm>-compare.md   (compare output)
```

## Done Criteria

- [ ] `parity` runs without external calls — local file inspection only (fast, deterministic)
- [ ] If only one install dir exists, exit cleanly with guidance (not an error)
- [ ] `compare` warns when reports are not within ±1 minute of each other (timing drift = false positives)
- [ ] P1 drift auto-registers via `/vibe.regress`

---

ARGUMENTS: $ARGUMENTS
