---
name: vibe-test
tier: core
description: "Self-test vibe across CC and coco. Subcommands: parity (static file/content comparison between ~/.claude and ~/.coco install dirs), report (runtime invocation of every command/skill/hook/agent/tool in the current harness), compare (diff two JSON reports). P1 drift (one-side missing) auto-registers via vibe-regress. Must use this skill when user runs /vibe.test, when verifying multi-harness compatibility before release, or when the user says 'parity', 'self-test', 'CC vs coco', 'both harnesses'."
triggers: [test, parity, self-test, "양쪽", "CC vs coco", "harness 동일"]
priority: 70
chain-next: []
---

# vibe-test — Multi-Harness Self-Test

**Purpose**: mechanically verify vibe presents the same surface in Claude Code and coco. Catch features broken on one harness before users do.

## Why this exists

Vibe explicitly supports two harnesses (CC, coco). When new commands are added, only one side might get updated, or `AGENTS.md` ↔ `CLAUDE.md` may drift, and there is no automated check until a user reports it. This skill closes that gap.

## Storage Contract

```
.claude/vibe/test-reports/    # CC side artifacts
.coco/vibe/test-reports/      # coco side artifacts (when run from coco)

  <YYYYMMDD-HHmm>-cc.json     # machine-comparable
  <YYYYMMDD-HHmm>-cc.md       # human summary
  <YYYYMMDD-HHmm>-coco.json
  <YYYYMMDD-HHmm>-coco.md
  <YYYYMMDD-HHmm>-parity.json # output of `parity` subcommand
  <YYYYMMDD-HHmm>-compare.md  # output of `compare` subcommand
```

### Report schema (JSON)

```json
{
  "harness": "cc | coco",
  "version": "2.9.21",
  "timestamp": "2026-04-14T18:30:00+09:00",
  "vibe-version": "from package.json",
  "commands": [
    { "name": "vibe.spec", "loaded": true, "first-response-ok": true, "error": null }
  ],
  "skills": [
    { "name": "vibe-spec", "trigger-recognized": true, "context-injected": true, "error": null }
  ],
  "hooks": [
    { "name": "pre-tool-guard", "test-suite": "passed | failed", "tests": "32/32" }
  ],
  "agents": [],
  "tools": []
}
```

## Subcommand: `parity` — static comparison (stage 1, in-scope target)

No harness execution. Only file system + body inspection. Fast and deterministic.

### Steps

1. **Confirm both install dirs exist**:
   - CC: `~/.claude/{commands,skills,agents}/`
   - coco: `~/.coco/{commands,skills,agents}/` (`COCO_HOME` env takes precedence)
   - If either side is missing, exit cleanly with guidance (not an error)

2. **Install set diff**:
   ```bash
   find ~/.claude/commands -type f -name '*.md' -exec basename {} \; | sort > /tmp/cc-cmds
   find ~/.coco/commands -type f -name '*.md' -exec basename {} \; | sort > /tmp/coco-cmds
   diff /tmp/cc-cmds /tmp/coco-cmds
   ```
   Repeat for skills/agents. Persist diff entries to `parity.json` field `install-set-diff`.

3. **Content sync (CLAUDE.md ↔ AGENTS.md)**:
   - Read both files; strip header block (leading `> ` lines plus filename mentions)
   - Normalize body: map `.claude` ↔ `.coco`, `Claude Code` ↔ `coco`, `CLAUDE.md` ↔ `AGENTS.md`
   - Lines that still differ after normalization go into `content-drift`

4. **Path reference validation**:
   - Extract `~/.claude/`, `.claude/vibe/` patterns from CLAUDE.md → confirm each resolves under the actual install dir
   - Extract `~/.coco/`, `.coco/vibe/` patterns from AGENTS.md → same check
   - Wrong paths (e.g. AGENTS.md referencing `.codex/` after a rename) classified as `path-error`

5. **Console output**:
   ```
   📊 PARITY REPORT

   Install set:
     ✅ commands: 14/14 matched
     ❌ skills: 1 missing in coco (vibe-test)

   Content sync:
     ✅ CLAUDE.md ↔ AGENTS.md normalized diff: clean

   Path references:
     ✅ all paths resolve to existing dirs

   📈 Parity Score: 95/100
   📁 Saved: .claude/vibe/test-reports/20260414-1830-parity.json
   ```

6. **Auto-register P1 drift**:
   - On `install-set-diff` finding → call `/vibe.regress register --from-test`
   - symptom: `"Parity drift: <category> missing in <harness>"`
   - root-cause-tag: `integration`

## Subcommand: `report` — runtime invocation (stage 2, TODO)

Invoke each feature and capture responses. Build after stage 1 stabilizes. v1 design must define:
- Probe shape per category for "successful invocation"
- Dry-run mode for interactive commands (e.g. `/vibe.spec`)
- Cost control for LLM-dependent features (mock vs real)

## Subcommand: `compare` — diff two reports

```
/vibe.test compare <cc-report.json> <coco-report.json>
```

### Steps

1. Load both JSON files. Compare timestamps; warn if delta > ±1 minute ("report timing skew detected, confidence low")
2. Match entries per category by `name`
3. Classify:
   - **P1**: present on only one side → missing
   - **P2**: present both sides but mismatched booleans (`loaded`, `first-response-ok`, `trigger-recognized`) → behavioral drift
   - **P3**: only error wording differs, behavior identical → informational
4. Persist result as `<ts>-compare.md`
5. P1 findings auto-register via `/vibe.regress`

## Integration Points

### Release flow

Recommended pre-release ritual:
```
1. From CC:   /vibe.test parity → must pass
2. From coco: /vibe.test parity → must pass (when feasible)
3. Both green → pnpm release
```

### To /vibe.regress

On P1 drift:
```
Load skill `vibe-regress` with:
  subcommand: register --from-test
  symptom: "<category> drift: <name> missing in <harness>"
  root-cause-tag: integration
```

## Done Criteria (v1: parity only)

- [ ] `parity` works without any external calls
- [ ] Missing one install dir → clean exit with guidance (not an error)
- [ ] `install-set-diff`, `content-drift`, `path-error` are reported as separate categories
- [ ] P1 findings invoke `/vibe.regress` automatically
- [ ] `compare` handles timing-skew warning correctly
