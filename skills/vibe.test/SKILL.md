---
name: vibe.test
description: Self-test vibe — probe every entry skill/skill/hook/agent in the target harness install dir and write a pass/fail report
argument-hint: "[cc|codex]  (empty = current harness)"
user-invocable: true
---

# /vibe.test

**Vibe Self-Test** — probe every shipped surface (commands, skills, hooks, agents) in a vibe install dir and emit a pass/fail report.

## Usage

```
/vibe.test         # Test current harness (auto-detect)
/vibe.test cc      # Force-test ~/.claude/
/vibe.test codex   # Force-test ~/.codex/
```

No subcommands. No CC-vs-Codex comparison semantics. One command, one report.

## Report

Stored in vibe's global dir (not per-project):

```
~/.vibe/test-reports/<YYYYMMDD-HHmm>-<harness>.json
~/.vibe/test-reports/<YYYYMMDD-HHmm>-<harness>.md
```

Markdown summary is also printed to the console when the run finishes.

## Process

Execute the bundled implementation below with target harness: `$ARGUMENTS`

- If `$ARGUMENTS` is empty, detect the current harness (CC vs Codex) and use that.
- If the target install dir is missing, exit cleanly with guidance (not an error).

See `skills/vibe.test/SKILL.md` for the probe spec and the report template.

## Done Criteria

- [ ] Runs without any external LLM call — file reads + vitest only
- [ ] A single probe failure never halts the overall run
- [ ] JSON report matches the template in SKILL.md exactly
- [ ] P1 failures auto-register via `/vibe.regress`

---

ARGUMENTS: $ARGUMENTS

## Bundled implementation


# test — Self-Test

Probe every shipped vibe surface in one install dir and emit a pass/fail report.

## Why this exists

When vibe ships new entry skills, skills, hooks, or agents, one side (CC or Codex) can end up out of sync with the other, frontmatter can drift, and hook tests can silently break. `vibe.test` is the single mechanical check: does every surface in the target install actually load and pass its own tests?

## Target harness

The argument selects which install dir to probe:

| Arg | Probed dir |
|---|---|
| (empty) | current harness — CC: `~/.claude/`, Codex: `~/.codex/` |
| `cc` | `~/.claude/` |
| `codex` | `~/.codex/` |

If the target dir does not exist, print a clear message and exit with guidance (not an error). Example:

```
~/.codex/ not found — Codex isn't installed on this machine.
  To install: npm i -g @openai/codex
```

## Probes

All probes are **structural or test-based** — no interactive command is ever actually invoked, and no LLM is called.

| Category | Source | Check |
|---|---|---|
| entry skills | `<install>/skills/vibe*/SKILL.md` | file readable · frontmatter parses · `name`, `description`, `user-invocable: true` present |
| skills | `<install>/skills/*/SKILL.md` | frontmatter parses · required fields (`name`, `description`) · body non-empty |
| hooks | repo `hooks/scripts/*.js` | for each script with a matching `__tests__/<name>.test.js`, run `npx vitest run <test> --reporter=json` and parse pass/fail counts |
| agents | `<install>/agents/*.md` | file readable · frontmatter parses · required fields (`name`, `description`) |

A probe's failure is captured in its `error` field; the overall run never halts because of one failure.

## Report template

Written to `~/.vibe/test-reports/<YYYYMMDD-HHmm>-<harness>.{json,md}`. Exact schema:

### JSON

```json
{
  "harness": "cc",
  "timestamp": "2026-04-16T18:30:00+09:00",
  "vibe_version": "2.9.24",
  "install_dir": "/Users/grove/.claude",
  "summary": {
    "total": 42,
    "passed": 40,
    "failed": 2
  },
  "probes": {
    "entrySkills": [
      { "name": "vibe.spec", "status": "pass" },
      { "name": "vibe.test", "status": "pass" }
    ],
    "skills": [
      { "name": "test", "status": "pass" },
      { "name": "spec", "status": "fail", "error": "invocation includes `auto` but triggers array is empty" }
    ],
    "hooks": [
      { "name": "pre-tool-guard", "status": "pass", "tests": "38/38" },
      { "name": "scope-guard", "status": "pass", "tests": "12/12" }
    ],
    "agents": [
      { "name": "implementer", "status": "pass" }
    ]
  },
  "failed": [
    {
      "category": "skills",
      "name": "spec",
      "error": "frontmatter: triggers array is empty"
    }
  ]
}
```

- `status`: `"pass"` | `"fail"`
- `error`: required when `status === "fail"`, omitted otherwise
- `tests` (hooks only): short `passed/total` string from the vitest JSON reporter
- `failed[]`: flat list of every failure for quick scanning — mirrors entries found across `probes.*`

### Markdown

```markdown
# vibe self-test · cc · 2026-04-16 18:30

**Version**: 2.9.24   **Install**: /Users/grove/.claude

| Category | Pass | Fail |
|---|---:|---:|
| entry skills | 15 | 0 |
| skills   | 17 | 1 |
| hooks    |  6 | 0 |
| agents   |  3 | 1 |
| **total**| **41** | **2** |

## Failures

- **skills / spec** — invocation includes `auto` but triggers array is empty
- **agents / implementer** — agent file not found
```

If `failed` is empty, replace the Failures section with `_All probes passed._`.

## Steps

1. **Resolve target**: argument (`cc` / `codex` / empty). Empty → detect current harness (`$CLAUDE_PROJECT_DIR` set → `cc`; else fall back to `cc`).
2. **Resolve install dir**: `cc` → `~/.claude`, `codex` → `~/.codex`. If missing → print guidance + exit.
3. **Read `vibe_version`** from `package.json` in the current repo.
4. **Walk each category**, run its check, append `{ name, status, error? }` to `probes.<category>`.
5. **Compute** `summary` counts and the flat `failed[]` list.
6. **Ensure** `~/.vibe/test-reports/` exists (`mkdir -p`, dir mode `0o700` — consistent with `~/.vibe/config.json`).
7. **Write** `<ts>-<harness>.json` and `<ts>-<harness>.md`.
8. **Print** the Markdown summary to the console.
9. **If `summary.failed > 0`**, load skill `vibe.regress` with `subcommand: register --from-test` and pass the failed entries. P1 = any probe with `status: fail`.

## Done Criteria

- [ ] No external LLM call — file reads + vitest runs only
- [ ] One probe failing never halts the overall run
- [ ] Target install dir missing → clean exit with guidance (not an error)
- [ ] JSON report matches the template above exactly (fields, types, naming)
- [ ] Markdown summary printed to console after the run
- [ ] Reports land in `~/.vibe/test-reports/`, never in project-local `.vibe/`
- [ ] `failed.length > 0` → auto-invokes `vibe.regress register --from-test`
- [ ] Entry skills are verified as user-invocable skill surfaces, not deprecated command files
