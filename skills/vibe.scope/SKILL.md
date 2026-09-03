---
name: vibe.scope
description: Scope — write the intent and scenarios (each bound to a check), get one human token in one approval message. Make sure the tools needed for building are in place before building.
user-invocable: false
---

# Scope — one approval

## Procedure

1. Turn the discovery result into scenarios. A scenario is stored only if it carries exactly one check type:
   - `run` command exit code · `file` exists/regex/contains/schema · `http` status/body · `eval` count of matching labelled cases · `human` no verdict (goes to the inbox)
   - A condition you cannot check gets `human` explicitly. An irreversible action (push, deploy, send, delete, spend) gets `irreversible: <action>`.
2. Check for missing scenario kinds yourself: the failure path, rollback, permission boundaries. Add them or say in one line why they are not needed.
3. Save with `vibe intent draft --stdin --json`, sending `{"intent": "...", "scenarios": "..."}` (both in English).
   - On rejection (`code 1`) fix the reasons and save again. Do not pass by deleting a rejected scenario — bind a check to it.
   - On success the response contains `token` when the project's token policy is `strict`; otherwise `token` is null and a plain yes in chat is enough.
4. Send **one** approval message:

```
Success conditions:
1. {then} [{check.type}]{ " ⚠ token" when irreversible }
…
Things you did not ask about (if any, at most 3): …
Needed before building (if any): {tools · skills · access}
To proceed, {paste {token} | say yes}.
```

5. When the user pastes the number (or says yes when no token was issued), run `vibe approve "{number}" --json` (or `vibe approve --json`). On `code 3` show the reason and ask again. On a change request go back to step 3.
6. When the state is APPROVED, move to `vibe.build`.

## Never

- Invent or guess a token.
- Leave a scenario as prose only. The harness does not store a scenario without a check.
