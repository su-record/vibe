---
name: vibe-test
tier: core
description: "Self-test vibe by probing every command/skill/hook/agent in a target harness install dir (~/.claude or ~/.coco) and writing a pass/fail report to ~/.vibe/test-reports/. Takes an optional harness argument (cc|coco); empty = current harness. Must use this skill when user runs /vibe.test, when verifying a vibe install before release, or when the user says 'self-test', 'harness 점검', 'vibe 건강'."
triggers: [test, self-test, "vibe 건강", "harness 점검", "자가검진"]
priority: 70
chain-next: []
---

# vibe-test — Self-Test

Probe every shipped vibe surface in one install dir and emit a pass/fail report.

## Why this exists

When vibe ships new commands, skills, hooks, or agents, one side (CC or coco) can end up out of sync with the other, frontmatter can drift, and hook tests can silently break. `/vibe.test` is the single mechanical check: does every surface in the target install actually load and pass its own tests?

## Target harness

The argument selects which install dir to probe:

| Arg | Probed dir |
|---|---|
| (empty) | current harness — CC: `~/.claude/`, coco: `~/.coco/` |
| `cc` | `~/.claude/` |
| `coco` | `~/.coco/` |

If the target dir does not exist, print a clear message and exit with guidance (not an error). Example:

```
~/.coco/ not found — coco isn't installed on this machine.
  To install: pnpm add -g @su-record/vibe-coco
```

## Probes

All probes are **structural or test-based** — no interactive command is ever actually invoked, and no LLM is called.

| Category | Source | Check |
|---|---|---|
| commands | `<install>/commands/*.md` | file readable · frontmatter parses · `description` present · body references a skill (`Load skill \`...\``) if it delegates |
| skills | `<install>/skills/*/SKILL.md` | frontmatter parses · required fields (`name`, `description`) · `triggers` array non-empty · body non-empty |
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
    "commands": [
      { "name": "vibe.spec", "status": "pass" },
      { "name": "vibe.test", "status": "pass" }
    ],
    "skills": [
      { "name": "vibe-test", "status": "pass" },
      { "name": "vibe-spec", "status": "fail", "error": "frontmatter: triggers array is empty" }
    ],
    "hooks": [
      { "name": "pre-tool-guard", "status": "pass", "tests": "38/38" },
      { "name": "keyword-detector", "status": "pass", "tests": "12/12" }
    ],
    "agents": [
      { "name": "explorer", "status": "pass" }
    ]
  },
  "failed": [
    {
      "category": "skills",
      "name": "vibe-spec",
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
| commands | 15 | 0 |
| skills   | 17 | 1 |
| hooks    |  6 | 0 |
| agents   |  3 | 1 |
| **total**| **41** | **2** |

## Failures

- **skills / vibe-spec** — frontmatter: triggers array is empty
- **agents / explorer** — agent file not found
```

If `failed` is empty, replace the Failures section with `_All probes passed._`.

## Steps

1. **Resolve target**: argument (`cc` / `coco` / empty). Empty → detect current harness (`$CLAUDE_PROJECT_DIR` set → `cc`; else fall back to `cc`).
2. **Resolve install dir**: `cc` → `~/.claude`, `coco` → `~/.coco`. If missing → print guidance + exit.
3. **Read `vibe_version`** from `package.json` in the current repo.
4. **Walk each category**, run its check, append `{ name, status, error? }` to `probes.<category>`.
5. **Compute** `summary` counts and the flat `failed[]` list.
6. **Ensure** `~/.vibe/test-reports/` exists (`mkdir -p`, dir mode `0o700` — consistent with `~/.vibe/config.json`).
7. **Write** `<ts>-<harness>.json` and `<ts>-<harness>.md`.
8. **Print** the Markdown summary to the console.
9. **If `summary.failed > 0`**, load skill `vibe-regress` with `subcommand: register --from-test` and pass the failed entries. P1 = any probe with `status: fail`.

## Done Criteria

- [ ] No external LLM call — file reads + vitest runs only
- [ ] One probe failing never halts the overall run
- [ ] Target install dir missing → clean exit with guidance (not an error)
- [ ] JSON report matches the template above exactly (fields, types, naming)
- [ ] Markdown summary printed to console after the run
- [ ] Reports land in `~/.vibe/test-reports/`, never in project-local `.claude/vibe/`
- [ ] `failed.length > 0` → auto-invokes `/vibe.regress register --from-test`
