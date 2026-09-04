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
3. If work is in progress (`state` is not NONE or ABANDONED), ask in one line: continue or start over? Starting over means `vibe abandon --reason "…"` first.
4. Pick the stage:

| state | stage | skill |
|---|---|---|
| NONE · ABANDONED · DRAFT without intent | discover | `vibe.discover` |
| DRAFT with intent | scope | `vibe.scope` |
| APPROVED · RUNNING with remaining | build | `vibe.build` |
| RUNNING without remaining · STUCK | prove | `vibe.prove` |
| DONE | handoff | `vibe.handoff` |

5. Load that skill and follow it.

## Never

- Say "done". Done is only what `vibe check` reports as DONE.
- Invent or guess a token. Only pass to `vibe approve` / `vibe authorize` a number the user pasted into chat.
- Surface more than three unasked things at once.
- Write a record (intent, scenarios, inbox, knowledge) in any language other than English. Talk to the user in the user's language.
