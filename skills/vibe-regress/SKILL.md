---
name: vibe-regress
tier: core
description: "Regression test auto-evolution. Registers bugs (auto from /vibe.verify failures or manual), generates preventive vitest/jest files from bug records, clusters repeated patterns (3+ same root-cause-tag) into shared tests, and imports historical `fix:` commits from git log. Storage: .claude/vibe/regressions/<slug>.md. Must use this skill when user runs /vibe.regress, when /vibe.verify produces a failure, or when the user says 'don't let this happen again' / 'regression test' / '회귀 테스트'."
triggers: [regress, regression, "회귀", "다시는", "반복 버그", "fix commit"]
priority: 70
chain-next: []
---

# vibe.regress — Regression Auto-Evolution

**Purpose**: never fix the same bug twice. Each fix grows a preventive test.

## Why this exists

A classic vibe-coding weakness: LLMs reintroduce bugs of the same class. Regression tests are the only mechanical defense. But if the human has to write the test every time, it gets skipped — so automate.

## Storage Contract

```
.claude/vibe/regressions/
  <bug-slug>.md       # one file per bug
  _cluster-<tag>.md   # shared-test design produced by `cluster`
```

### Frontmatter schema (strict)

```yaml
slug: string            # kebab-case, globally unique
symptom: string         # one line, user-facing
root-cause-tag: enum    # only the allowed tags below
fix-commit: string      # git hash (or "pending")
test-path: string       # generated test file path (or "pending")
status: open | test-generated | resolved
registered: YYYY-MM-DD
feature: string         # related feature name (matches SPEC)
```

### Allowed `root-cause-tag` values

Clustering depends on this, so use **only the predefined set**:

- `timezone` — timezone / DST / off-by-one in time
- `nullability` — null / undefined / empty handling
- `concurrency` — race conditions
- `boundary` — off-by-one, edge values
- `encoding` — charset, URL encoding, escaping
- `validation` — missing input validation
- `auth` — authn/authz logic
- `state-sync` — client/server state mismatch
- `integration` — external API call failure
- `type-narrow` — TypeScript type narrowing mistake
- `other` — when nothing fits (add new tags later)

**Rule**: if a new tag is needed, do not force-fit into an existing one — register as `other`. Once `other` reaches 3 entries, propose adding a new tag.

## Subcommands

### 1. `register "<symptom>"` — manual registration

Most calls are automatic; manual use is rare (bugs found outside `/vibe.verify`, or production incidents).

**Steps**:
1. `getCurrentTime` for today's date
2. `git log -1 --format=%H` for current commit hash (fix-commit candidate)
3. Conversation extracts:
   - Reproduction steps (Given/When/Then)
   - Root-cause paragraph
   - Fix description
4. `root-cause-tag` is **inferred from the allowed set, then confirmed with the user**. If unclear → `other`.
5. Generate slug: kebab-case keywords from the symptom; on collision append `-2`
6. Write `.claude/vibe/regressions/<slug>.md` (status: `open`)

### 2. `generate <slug>` — generate preventive test

**Steps**:
1. Read bug file
2. Detect test stack:
   - From `package.json` `devDependencies`: prefer `vitest` over `jest`
   - If neither → **ask user, then stop**
3. Decide test location:
   - Sibling `__tests__/` next to the implementation file, OR
   - The project's existing test dir (vitest config `test.include`)
4. File name: `<original-file>.regression.test.ts`
5. Body: render `templates/test-vitest.md` or `templates/test-jest.md`
6. Update bug frontmatter: `test-path`, `status: test-generated`
7. **Run the test immediately** — should fail (if not yet fixed) or pass (if fixed). Record outcome in frontmatter.

### 3. `list` — open items

```
/vibe.regress list                 # status != resolved
/vibe.regress list --feature login # filter by feature
/vibe.regress list --tag timezone  # filter by tag
```

Terminal table:

```
SLUG                              FEATURE   TAG         STATUS           AGE
login-jwt-expiry-off-by-one       login     timezone    test-generated   3d
cart-stock-race-double-deduct     cart      concurrency open             1d
```

### 4. `import` — backfill from git log

**Steps**:
1. `git log --grep='^fix:' --format='%H|%s|%ci' --since=<last-import-date>`
   - `last-import-date` lives in `.claude/vibe/regressions/.import-cursor` (defaults to 90 days ago)
2. For each commit:
   - If a bug file with the same `fix-commit` already exists → **skip**
   - Otherwise infer symptom + root-cause-tag from message/diff (LLM call)
   - Write a new bug file (status: `resolved` — already fixed)
3. Update `.import-cursor`
4. Suggest `generate` for newly imported entries

**Note**: only `fix:` commits are considered. Projects not using Conventional Commits can override with `--grep-pattern`.

### 5. `cluster` — promote recurring patterns

**Steps**:
1. Aggregate `root-cause-tag` across all bug files
2. **A tag with ≥3 entries** becomes a cluster candidate
3. For each candidate:
   - Feed the 3 reproductions to an LLM to extract the common cause and shared test cases
   - Write `_cluster-<tag>.md` (links to the original bug slugs)
   - Propose a shared test skeleton at `<project-test-dir>/_cluster-<tag>.regression.test.ts` (create only with user approval)
4. Original bug files are **not deleted** — history preserved

**Important**: `cluster` is never automatic. Users invoke it explicitly to avoid premature abstraction.

## Integration with /vibe.verify

When `/vibe.verify` fails it calls:

```
Load skill `vibe-regress` with: register --from-verify
  <feature>: {feature-name}
  <scenario>: {failed-scenario}
  <error>: {error-message}
  <location>: {file:line}
```

`--from-verify` behavior:
- symptom = scenario name + error summary
- feature = forwarded feature name
- root-cause-tag = inferred from error pattern (default `other` if unclear)
- status = `open`
- **Skip user confirmation** — the user is already attentive in a verify-failure context, and friction must be minimized

## Integration with /vibe.run

At the start of `/vibe.run "<feature>"`:

1. Filter `.claude/vibe/regressions/*.md` for `feature: <feature-name>` + `status != resolved`
2. If any open items:
   ```
   ⚠️  Open regressions for this feature:
     - login-jwt-expiry-off-by-one (timezone, 3d old)
     - login-session-leak (auth, 1w old)

   Fix these before adding new behavior? [y/N]
   ```
3. `y` → chain to `/vibe.regress generate` for items not yet test-generated
4. `N` → continue (ultrawork mode auto-`N`, records TODO)

## Done Criteria

- [ ] Subcommand-less invocation prints usage
- [ ] Frontmatter schema strictly enforced (missing fields rejected)
- [ ] `root-cause-tag` outside the allowed set → warn + force `other`
- [ ] After `generate`, the test is **actually run** to verify
- [ ] `import` deduplicates by `fix-commit` hash
- [ ] `cluster` does nothing under 3 entries (false-positive guard)
