---
name: vibe-scope
description: Scope — write the intent and scenarios (each bound to a check), get one human token in one approval message. Make sure the tools needed for building are in place before building.
user-invocable: false
---

# Scope — one approval

## Procedure

Read fewer relevant files, each in full (Claude Read; Codex `cat`); grep/rg/find locate only, never substitute content slices. Over 400 lines when not editing: `vibe read --ask`.

1. Turn the discovery result into scenarios. A scenario is stored only if it carries exactly one check type:
   - `run` command exit code · `file` exists/regex/contains/absent (a regex that must match nowhere)/traceable (every number is in an evidence file)/a11y (mechanical accessibility defects)/schema/sum (a column total equals a reference) · `http` status/schema/maxMs · `eval` count of matching labelled cases (jsonl `{input, expected}` through a runner's stdin/stdout, `expect.pass` is a count) · `review` an antislop pack's reviewer stages in order (text: copy editor → chief editor; design: markup reviewer → art director; code: reviewer → maintainer), run by the harness, exact `PASS` only · `human` no verdict (goes to the inbox)
   - When a success condition is human-read text (blog, column, article, report, script, speech), propose `check: { type: review, path: <file>, contract: <file>, evidence: <file> }` and mark it `⚠ model-judged` in the approval message.
   - When it is something a person looks at (screen, page, component, dashboard, slide, card news, poster), propose `check: { type: review, pack: design, path: <file or directory>, contract: <brief>, screenshot: <png, if an earlier scenario renders one> }`, same mark.
   - When the code will be read or maintained by someone else (a library, a contribution, a handoff), propose `check: { type: review, pack: code, path: <directory>, contract: <brief>, changed: true }`, same mark; `changed: true` reviews what changed against HEAD and its one-hop importers instead of the whole directory (a git ref instead of `true` diffs against it) — propose it on every `review` of a directory in a git repository; otherwise `vibe size` stays the code gate.
   - Next to a text `review` that has an evidence file, propose `check: { type: file, path: <file>, traceable: <evidence file> }` (every number in the text is in the evidence); next to a design `review` on html, `check: { type: file, path: <html>, a11y: true }` (alt, heading order, unnamed controls, unlabelled inputs, contrast). These check facts; the reviewers keep the judgment.
   - A check observes. A `run` command that changes state (restore, reset, seed, migrate down, push, deploy) is detected and marked `irreversible`; `check --all` will not run it without `vibe authorize`, and it cannot become a regression. Rewrite such a check to observe — run against a copy, read the result — or declare `irreversible: <action>` and say so in the approval message.
   - Next to every `review`, propose its deterministic pre-gate on the same file: `check: { type: file, path: <file>, absent: "@placeholders" }` — the preset is the usual leftovers (lorem-ipsum text, a bracketed TODO, a to-be-decided mark, a company-name placeholder, unfilled double-brace fields, double-square-bracket notes); add the project's own words with `|`. For a directory, a `run` check with `grep -rlE` and `expect: 1`. Tell the writer that a note to the model goes between double square brackets, so the gate catches it if it survives into the artifact.
   - A condition you cannot check gets `human` explicitly. An irreversible action (push, deploy, send, delete, spend) gets `irreversible: <action>`.
   - A scenario that only makes sense after another one has passed gets `needs: [ids]`. The harness orders and parallelises checks from these edges; keep a connected graph under six scenarios.
2. Probe an unresolved technical assumption only when it can change the scope; reuse available evidence for established facts. Put a consequential probe's result in Why. Write a missing acceptance-check script under `checks/` before the implementation it will judge; it must run with the user's accessible data and answers, without a private grading key. A failing check for unfinished work is valid; an unavailable oracle is not.
3. Check for missing scenario kinds yourself: the failure path, rollback, permission boundaries. Add them or say in one line why they are not needed. When the intent writes code, propose a size gate: `check: { type: run, cmd: "vibe size src --max-file 400 --max-function 50" }`.
4. Save with `vibe intent draft --stdin --json`, sending `{"intent": "...", "scenarios": "...", "sources": ["docs/rules.md"]}` (records in English). List the actual stable evidence/customer-answer files used; omit sources when none apply. Do not list mutable session prompts or generated outputs. The source hashes bind the approval to the evidence. On resumption, `vibe intent show --json` reports `sourceBasis`; reuse unchanged findings and re-evaluate changed or missing inputs before redrafting the affected scope.
   - On rejection (`code 1`) fix the reasons and save again. Do not pass by deleting a rejected scenario — bind a check to it.
   - On success the response contains `token` when the project's token policy is `strict`; otherwise `token` is null and a plain yes in chat is enough.
5. Run `vibe intent analyze` once to check consistency; resolve uncovered commitments and unrequested scope without deleting a required outcome. This text comparison does not establish that the customer's problem is the right one. Use `vibe research` or `vibe skill suggest` only for a named gap that existing tools/evidence cannot resolve; a local file task needs neither by default. Reuse an installed capability before proposing an integration. Include a needed tool's exact setup, access, check, and rollback in the approval message. Install only within the authorization the user has actually given; a discovery request alone does not authorize an external change.
6. Send **one** approval message:

```
Success conditions:
1. {then} [{check.type}]{ " ⚠ token" when irreversible }
…
Found on GitHub (if any, at most 5): {ref} — {why} → {action}
Skill proposals (if any, at most 3): {kind} {ref} — {why}
Things you did not ask about (if any, at most 3): …
Needed before building (if any): {tools · skills · access}
To proceed, {paste {token} | say yes}.
```

7. When the user pastes the number (or says yes when no token was issued), run `vibe approve "{number}" --json` (or `vibe approve --json`). Unanswered material questions or changed evidence need resolution first; never substitute their defaults. On `code 3` show the actual reason and follow it. A material change returns to step 3; an unchanged approval needs no new interview. An old authorization does not cover a new action or target.
8. When the state is APPROVED and any accepted skill is installed, move to `vibe-build`.

## Never

- Invent or guess a token.
- Leave a scenario as prose only. The harness does not store a scenario without a check.
