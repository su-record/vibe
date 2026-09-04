---
name: vibe-scope
description: Scope — write the intent and scenarios (each bound to a check), get one human token in one approval message. Make sure the tools needed for building are in place before building.
user-invocable: false
---

# Scope — one approval

## Procedure

1. Turn the discovery result into scenarios. A scenario is stored only if it carries exactly one check type:
   - `run` command exit code · `file` exists/regex/contains/schema/sum (a column total equals a reference) · `http` status/schema/maxMs · `eval` count of matching labelled cases (jsonl `{input, expected}` through a runner's stdin/stdout, `expect.pass` is a count) · `review` a language pack's copy editor then chief editor, run by the harness, exact `PASS` only · `human` no verdict (goes to the inbox)
   - When a success condition is human-read text (blog, column, article, report, script, speech), propose `check: { type: review, path: <file>, contract: <file>, evidence: <file> }` and mark it `⚠ model-judged` in the approval message.
   - A condition you cannot check gets `human` explicitly. An irreversible action (push, deploy, send, delete, spend) gets `irreversible: <action>`.
   - A scenario that only makes sense after another one has passed gets `needs: [ids]`. The harness orders and parallelises checks from these edges; keep a connected graph under six scenarios.
2. Check for missing scenario kinds yourself: the failure path, rollback, permission boundaries. Add them or say in one line why they are not needed. When the intent writes code, propose a size gate: `check: { type: run, cmd: "vibe size src --max-file 400 --max-function 50" }`.
3. Save with `vibe intent draft --stdin --json`, sending `{"intent": "...", "scenarios": "..."}` (both in English).
   - On rejection (`code 1`) fix the reasons and save again. Do not pass by deleting a rejected scenario — bind a check to it.
   - On success the response contains `token` when the project's token policy is `strict`; otherwise `token` is null and a plain yes in chat is enough.
4. Research and proposals, once, before the approval message: `vibe research --from-intent --json` (up to five candidates with an action each; skip silently on exit 2 and say "no network") and `vibe skill suggest --json` (up to three). Show both in the approval message. Do not install anything — the user says "add 1" and you run the printed `vibe skill add …` (preview first, `--yes` after they have seen the commands).
5. Send **one** approval message:

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

6. When the user pastes the number (or says yes when no token was issued), run `vibe approve "{number}" --json` (or `vibe approve --json`). On `code 3` show the reason and ask again. On a change request go back to step 3.
7. When the state is APPROVED and any accepted skill is installed, move to `vibe-build`.

## Never

- Invent or guess a token.
- Leave a scenario as prose only. The harness does not store a scenario without a check.
