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

## Subcommand: `report` — runtime invocation

Inspect every shipped feature in the current harness, capture pass/fail, and emit the JSON+MD report defined above.

### Probe philosophy

- **No external LLM calls.** The probe is structural + execution-based, not generative. Cost ≈ a few file reads plus running `vitest`.
- **Interactive commands are NOT actually invoked.** Calling `/vibe.spec` would block on the interview loop. Probe checks structural validity only and records `invocable: true` if the file is well-formed.
- **Hooks and tools have real unit tests** in the repo — run them, do not simulate.
- A probe failure never stops the run. Each entry's `error` field captures the cause; the report keeps going.

### Steps

1. **Resolve install dir for current harness**:
   - CC: `~/.claude/`
   - coco: `~/.coco/` (`COCO_HOME` overrides)
   - Detect via `process.env.COCO_HOME` first, then which one is currently being read from. If both present, use the harness this skill was invoked from.

2. **Probe `commands`** — for each `<install>/commands/*.md`:
   - `loaded`: file exists and is non-empty
   - `frontmatter-valid`: YAML frontmatter parses; required keys present (`description`)
   - `argument-hint-present`: optional but recorded
   - `body-references-skill`: body contains `Load skill ` or `## Process` (signal that the command delegates correctly)
   - Result: `{ name, loaded, frontmatter-valid, body-references-skill, error }`

3. **Probe `skills`** — for each `<install>/skills/*/SKILL.md`:
   - `loaded`: file exists
   - `frontmatter-valid`: YAML parses with required keys: `name`, `tier`, `description`, `triggers`
   - `triggers-non-empty`: triggers array has ≥1 entry
   - `description-mentions-trigger-conditions`: heuristic — description contains `Must use this skill when` or equivalent (vibe convention)
   - Result: `{ name, loaded, frontmatter-valid, triggers-count, error }`

4. **Probe `hooks`** — for each `<install>/hooks/scripts/*.js` (or repo `hooks/scripts/` if testing the source):
   - If a matching `__tests__/<hook-name>.test.js` exists → run `npx vitest run hooks/scripts/__tests__/<hook>.test.js --reporter=json` and parse the result
   - If no test exists → mark `test-suite: "no-tests"` (warn, not fail)
   - Result: `{ name, test-suite: "passed" | "failed" | "no-tests", tests: "<passed>/<total>", error }`

5. **Probe `agents`** — for each `<install>/agents/*.md`:
   - `loaded`, `frontmatter-valid` (required: `name`, `description`, `tools`)
   - `tools-list-valid`: every tool in the `tools` array matches a known harness tool (Read, Glob, Grep, Bash, Edit, Write, WebSearch, WebFetch, Task, plus the agent-specific Skill etc.)
   - Result: `{ name, loaded, frontmatter-valid, tools-list-valid, error }`

6. **Probe `tools`** — for each tool exported from `dist/tools/index.js`:
   - If a matching test file exists in `src/tools/__tests__/` → run vitest and capture pass/fail
   - If no test → call the tool with a minimal known-safe input (e.g. `validateCodeQuality` against a tiny fixture) and verify the response is well-shaped JSON
   - Result: `{ name, test-suite | smoke-call, status, error }`

7. **Compile JSON + Markdown reports** to `<project-vibe-dir>/test-reports/<YYYYMMDD-HHmm>-<harness>.{json,md}` per the schema above.

8. **Print summary**:
   ```
   📊 RUNTIME REPORT (cc)
     commands: 14/14 loaded, 14/14 frontmatter-valid
     skills:   28/28 loaded, 1 missing description-mentions-trigger-conditions
     hooks:    7/7 test suites passed (118/118 tests)
     agents:   42/42 loaded, 0 with invalid tools
     tools:    9/9 passing
   📈 Score: 99/100
   📁 .claude/vibe/test-reports/20260414-1845-cc.json
   ```

### Failure handling

| Probe failure | Action |
|---|---|
| frontmatter parse error | record + continue |
| missing required key | record + continue |
| vitest run failure | capture stderr summary into `error` field, continue |
| tool smoke-call exception | record exception type + continue |
| install dir not found | abort with clear message — cannot probe what is not installed |

### What this catches

- A new command added in source but missed by `postinstall` (file present in repo, absent from `~/.claude/commands/`)
- Skill with malformed frontmatter (would fail to register at runtime)
- Agent listing a tool that does not exist in the harness
- Hook unit test regression (matches existing CI guard but locally observable)
- Tool that broke between the test fixture and the shipped build

### What this does NOT catch

- LLM behavioral drift (interactive command actually behaving differently)
- Race conditions in agent orchestration
- Real-world failures that depend on user input

These belong to higher-effort future work (functional e2e, currently not in scope).

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

## Done Criteria

### Subcommand: parity
- [ ] Works without any external calls
- [ ] Missing one install dir → clean exit with guidance (not an error)
- [ ] `install-set-diff`, `content-drift`, `path-error` reported as separate categories
- [ ] P1 findings invoke `/vibe.regress` automatically
- [ ] `compare` handles timing-skew warning correctly

### Subcommand: report
- [ ] No external LLM calls (cost = file reads + vitest runs only)
- [ ] Interactive commands probed structurally, never actually invoked
- [ ] Hook and tool tests run via real vitest, not simulated
- [ ] A probe failure on one entry never stops the run
- [ ] JSON report matches the schema in "Storage Contract"
- [ ] Markdown summary printed to console after run completes
- [ ] Install dir absent → abort with clear message (not silent)
