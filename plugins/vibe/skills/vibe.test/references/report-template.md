# vibe.test — Report Template (JSON + Markdown)

> vibe.test SKILL.md 의 Report 섹션에서 참조. `~/.vibe/test-reports/<ts>-<harness>.{json,md}` 의 정확한 스키마.

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
    "passed": 38,
    "warned": 2,
    "failed": 2
  },
  "probes": {
    "entrySkills": [
      { "name": "vibe.spec", "status": "pass" },
      { "name": "vibe.test", "status": "pass" }
    ],
    "skills": [
      { "name": "vibe.verify", "status": "pass",
        "quality": { "scope": "pass", "context": "pass", "trigger": "pass", "verify": "pass" } },
      { "name": "vibe.run", "status": "fail",
        "quality": { "scope": "fail", "context": "warn", "trigger": "warn", "verify": "warn" },
        "error": "scope: 845 lines (>400)" },
      { "name": "spec", "status": "fail", "error": "invocation includes `auto` but triggers array is empty" }
    ],
    "hooks": [
      { "name": "pre-tool-guard", "status": "pass", "tests": "38/38" },
      { "name": "scope-guard", "status": "pass", "tests": "12/12" }
    ],
    "agents": [
      { "name": "implementer", "status": "pass" },
      { "name": "ui/design-reviewer", "status": "pass" },
      { "name": "event/event-planner", "status": "pass" }
    ]
  },
  "failed": [
    {
      "category": "skills",
      "name": "spec",
      "error": "frontmatter: triggers array is empty"
    }
  ],
  "warned": [
    {
      "category": "skills",
      "name": "vibe.docs",
      "error": "verify: no Done Criteria section"
    }
  ]
}
```

- `status`: `"pass"` | `"warn"` | `"fail"` — worst verdict across the entry's structural check and its four quality axes
- `error`: required when `status` is `"warn"` or `"fail"`, omitted otherwise. Prefix with the axis (`scope:`, `context:`, `trigger:`, `verify:`) when the verdict comes from a quality axis
- `quality` (skills only): per-axis verdicts — `{ scope, context, trigger, verify }`, each `"pass"` | `"warn"` | `"fail"` | `"n/a"` (alias-exempt axis)
- `tests` (hooks only): short `passed/total` string from the vitest JSON reporter
- `failed[]`: flat list of every `fail` for quick scanning — mirrors entries found across `probes.*`
- `warned[]`: same shape as `failed[]`, for `warn` entries. **Advisory only — never feeds `/vibe.regress`**

### Markdown

```markdown
# vibe self-test · cc · 2026-04-16 18:30

**Version**: 2.9.24   **Install**: /Users/grove/.claude

| Category | Pass | Warn | Fail |
|---|---:|---:|---:|
| entry skills | 15 | 0 | 0 |
| skills   | 15 | 2 | 1 |
| hooks    |  6 | 0 | 0 |
| agents   |  3 | 0 | 1 |
| **total**| **39** | **2** | **2** |

## Skill quality (STCV)

| Skill | Scope | Context | Trigger | Verify |
|---|---|---|---|---|
| vibe.run | ❌ 845 | ⚠️ | ⚠️ | ⚠️ |
| vibe.docs | ⚠️ 292 | ✅ | ✅ | ⚠️ |

Only skills with at least one non-pass axis are listed. If every skill passes all four axes,
replace this section with `_All skills pass STCV._`

## Failures

- **skills / spec** — invocation includes `auto` but triggers array is empty
- **agents / implementer** — agent file not found
```

If `failed` is empty, replace the Failures section with `_All probes passed._`.
