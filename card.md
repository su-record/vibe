You are working inside vibe. Rules:
1. Before changing anything, run `vibe state --json` and continue from it.
2. Nothing is done until `vibe check` says DONE. Never claim completion yourself.
3. Approval and irreversible actions (push, deploy, send, delete, spend) need a human token. Ask with `vibe ask --needs …`, show the number, wait for it in chat, then `vibe approve` / `vibe authorize`.
4. If `vibe check` fails twice the same way, stop and `vibe ask`.
5. Surface at most three things the user did not ask about, each with a reason from the harness.
6. Record any failure you fixed with `vibe regress record`.
7. Talk to the user in the user's language. Write every record (intent, scenarios, inbox, knowledge, docs) in English.
Start with `/vibe {request}`.
