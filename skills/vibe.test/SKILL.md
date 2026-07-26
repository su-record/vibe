---
name: vibe.test
description: Use when verifying that a vibe install is intact or that CC and Codex are in sync — before a release, after changing skills/hooks/agents, or when a harness behaves inconsistently. Probes every shipped surface in the target install dir and writes a pass/fail report with STCV skill-quality verdicts.
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

Probe spec: below. Report schema: `references/report-template.md`.

## Done Criteria

- [ ] Runs without any external LLM call — file reads + vitest only
- [ ] A single probe failure never halts the overall run
- [ ] JSON report matches `references/report-template.md` exactly
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
| agents | `<install>/agents/**/*.md` (**recursive**) | file readable · frontmatter parses · required fields (`name`, `description`) |
| skill quality | `<install>/skills/*/SKILL.md` | STCV 4-axis quality check (below) |

A probe's failure is captured in its `error` field; the overall run never halts because of one failure.

**Agent discovery must recurse.** Agents live in subdirectories by capability group —
`agents/ui/*.md` and `agents/event/*.md` are installed conditionally per stack/capability. A
non-recursive `agents/*.md` glob silently skips 4 of the 11 shipped agents, so the report claims
parity it never checked. Record each agent by its path-relative name (`ui/design-reviewer`, not
`design-reviewer`) so group membership stays visible in the report.

### Skill quality (STCV)

Structural checks only — line counts, directory existence, and section/word presence. **No LLM call**, consistent with the rest of the probes.

| Axis | Check | Verdict |
|---|---|---|
| **S**cope | SKILL.md line count | ≤250 `pass` · 251–400 `warn` · >400 `fail` |
| **C**ontext | body fenced code blocks ≥3 **and** no sibling `references/` dir | `warn` |
| **T**rigger | `description` contains no activation-condition wording | `warn` |
| **V**erify | no `Done Criteria` / `완료 기준` section in body | `warn` |

**WHY each axis** — a skill is loaded whole into context on invocation, so an oversized SKILL.md
spends the caller's context on material most invocations never need (Scope), and material that
*is* only needed sometimes belongs behind a reference pointer (Context). `description` is the
only signal `/vibe` Catch-all routing sees, so a purely descriptive one cannot be matched against
a request (Trigger). And a skill with no stated completion test cannot be judged by the
deterministic JUDGE step in `vibe/rules/loop-contract.md` (Verify).

Axis detail:

- **Scope** — count lines of `SKILL.md` verbatim (frontmatter included). The `fail` threshold is
  deliberately above the `warn` threshold so that a skill drifting past 250 gets flagged long
  before it breaks the build.
- **Context** — count ` ``` ` fence *pairs* in the body. Three or more blocks with no `references/`
  sibling directory means templates/examples/schemas are inlined where they should be extracted.
  A skill with a `references/` dir passes regardless of fence count.
- **A `references/` dir is not by itself a pass.** The context axis asks whether *conditional bulk
  still sits inline*, not whether the directory exists — a 6-line reference file next to a 150-line
  body clears the directory check while saving nothing. Judge the body: does it still inline a
  block that most invocations skip? If yes, the axis warns regardless of the sibling directory.
- **Safety and correctness rules never move behind a conditional load.** "Read
  `references/protected-branches.md` if the branch is protected" is circular — deciding whether the
  rule applies requires already knowing the rule. Anything the skill must obey *before* it can
  classify the situation (destructive-operation guards, push/force-push prohibitions, data-loss
  boundaries) stays inline. Only material that is *looked up after* the situation is known is
  eligible.
- **Anti-gaming (scope + context)** — a reference only saves context if it is **conditionally**
  loaded. If the body instructs reading a reference unconditionally ("read `references/x.md`" with
  no condition attached), nothing was saved: the invocation now costs body + reference *plus* an
  extra round trip. Emit `scope: warn` with `"unconditional reference load"` when a skill's body is
  small but a reference it always loads is large — regardless of the line count passing. **A stub
  that forwards to a wholesale copy of its own former body is a regression, not a split.** The test
  for a real split: name a plausible invocation that never needs the reference. If none exists, the
  material belongs inline.
- **Trigger** — the `description` must contain at least one activation-condition marker:
  `when` / `if` / `use for` / `use when` / `…할 때` / `…하면` / `…인 경우` / `…이 있고`.
  A bare capability restatement (`"Execute implementation from SPEC"`) has none and warns.
- **Verify** — case-insensitive search for a heading containing `Done Criteria` or `완료 기준`.

**Alias exemption**: a merged skill leaves behind a thin alias — a body of ≤20 lines whose only
content is a pointer at the canonical skill. Aliases are exempt from the **context** and **verify**
axes: they hold no templates to extract and no work to complete, so demanding `references/` or a
`Done Criteria` section would only pad them back into the duplication the merge removed. **Scope and
trigger still apply** — an alias must stay small and must still say when it fires. Mark exempt axes
`"n/a"` in the `quality` object rather than `"pass"`, so the report never claims a check it skipped.

**Severity policy**: only `scope` can produce `fail`. The other three axes emit `warn` in this
release — `verify` in particular currently applies to 17 of the 22 entry skills, and promoting it
to `fail` before that backlog clears would ship a self-test that fails on vibe's own package and
flood `/vibe.regress` with P1s. Promote `verify` to `fail` for entry skills in a later release
once those skills carry Done Criteria.

Quality findings attach to the existing skill entry rather than creating a second entry per skill:

```json
{ "name": "vibe.run", "status": "fail",
  "quality": { "scope": "fail", "context": "warn", "trigger": "warn", "verify": "warn" },
  "error": "scope: 845 lines (>400)" }
```

A skill's `status` is the worst verdict across its structural check and all four axes
(`fail` > `warn` > `pass`).

## Report template

JSON 스키마와 Markdown 출력 포맷의 전문(필드·타입·명명·Warnings/STCV 섹션):
`references/report-template.md`

핵심 계약만 요약:

- `status`: `"pass"` | `"warn"` | `"fail"` — 구조 검사와 STCV 4축 중 **최악** 판정
- `quality` (skills 만): `{ scope, context, trigger, verify }`, 각 `pass`/`warn`/`fail`/`n/a`
- `failed[]` 는 `fail` 만, `warned[]` 는 `warn` 만. **`warned[]` 는 절대 `vibe.regress` 로 넘기지 않는다**

## Steps

1. **Resolve target**: argument (`cc` / `codex` / empty). Empty → detect current harness (`$CLAUDE_PROJECT_DIR` set → `cc`; else fall back to `cc`).
2. **Resolve install dir**: `cc` → `~/.claude`, `codex` → `~/.codex`. If missing → print guidance + exit.
3. **Read `vibe_version`** from `package.json` in the current repo.
4. **Walk each category**, run its check, append `{ name, status, error? }` to `probes.<category>`.
5. **Run the STCV check** on every `skills` entry, attach `quality`, and fold the worst axis verdict into that entry's `status`.
6. **Compute** `summary` counts and the flat `failed[]` / `warned[]` lists.
7. **Ensure** `~/.vibe/test-reports/` exists (`mkdir -p`, dir mode `0o700` — consistent with `~/.vibe/config.json`).
8. **Write** `<ts>-<harness>.json` and `<ts>-<harness>.md`.
9. **Print** the Markdown summary to the console.
10. **If `summary.failed > 0`**, load skill `vibe.regress` with `subcommand: register --from-test` and pass the failed entries. P1 = any probe with `status: fail`. **`warned[]` is never passed to regress** — warnings are advisory and must not create P1 backlog.

## Done Criteria

- [ ] No external LLM call — file reads + vitest runs only
- [ ] One probe failing never halts the overall run
- [ ] Target install dir missing → clean exit with guidance (not an error)
- [ ] JSON report matches the template above exactly (fields, types, naming)
- [ ] Markdown summary printed to console after the run
- [ ] Reports land in `~/.vibe/test-reports/`, never in project-local `.vibe/`
- [ ] `failed.length > 0` → auto-invokes `vibe.regress register --from-test`
- [ ] `warned.length > 0` alone never invokes `vibe.regress`
- [ ] Every `skills` entry carries a `quality` object with all four STCV axes
- [ ] Agent discovery recurses — `agents/ui/*` and `agents/event/*` appear in the report under their group-qualified names
- [ ] Entry skills are verified as user-invocable skill surfaces, not deprecated command files
