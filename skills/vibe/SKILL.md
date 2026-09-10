---
name: vibe
description: Single entry point. Reads the user's request and `vibe state`, then routes to the right FDE stage (discover · scope · build · prove · handoff). Start with "/vibe {request}".
user-invocable: true
---

# /vibe {request}

The user says what they want in their own words. You pick the stage. This is the only place where model judgement is allowed.

If `vibe` is not on PATH, run `npm i -g @su-record/vibe` once; every command below is that CLI.

## Procedure

1. Run `vibe state --json`. A directory without `.vibe/` answers NONE; the first record creates it.
2. If `notices` is non-empty, show them to the user first.
3. If work is in progress (`state` is not NONE or ABANDONED) and the user's request is a new one, ask in one line: continue or start over? Starting over means `vibe abandon --reason "…"` first.
4. Follow the `next` line. It is the procedure; a stage skill is loaded only when `next` names one:

| `next` starts with | do |
|---|---|
| `discover` | load `vibe-discover` |
| `approve` | load `vibe-scope` — sufficient agreement, runnable checks, `vibe intent analyze`, one approval message; research only for an unresolved gap |
The card starts at `vibe state` and loads only the skill `next` names; this router is for an explicit `/vibe` and says the same thing.

| `build …` | build what it lists first, then one `vibe check --all`; on a failure, fix what the check names; `vibe context <id>` when that is not enough, then `vibe check <id>` for that scenario only; load `vibe-build` only for a full task with parallel or irreversible scenarios |
| `check --all` | run it |
| `prove — STUCK` · `answer inbox` | answer the question, then `vibe check --all`; load `vibe-prove` on a second STUCK |
| `report` | the completion report (card rule 9); HANDOFF.md only if the intent asks; no further checks after DONE |

Reuse an approved intent and unchanged evidence. Re-enter scope only for a changed outcome, constraint, or evidence basis: a new draft voids the previous approval.

## Never

- Say "done". Done is only what `vibe check` reports as DONE.
- Invent or guess a token. Only pass to `vibe approve` / `vibe authorize` a number the user pasted into chat.
- Surface more than three unasked things at once.
- Write a record (intent, scenarios, inbox, knowledge) in any language other than English. Talk to the user in the user's language.
