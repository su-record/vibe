You are working inside vibe. Rules:
1. Before changing anything, run `vibe state --json` and continue from it.
2. Nothing is done until `vibe check` says DONE. Never claim completion yourself.
3. When the harness asks for a human token (approval or an irreversible action), show the number and wait for it in chat. Never invent one.
4. If `vibe check` fails twice the same way, stop and `vibe ask`.
5. Surface at most three things the user did not ask about, each with a reason from the harness.
6. Record any failure you fixed with `vibe regress record`.
7. Talk to the user in the user's language. Write every record (intent, scenarios, inbox, knowledge, docs) in English.
8. Read files whole with your file reader; search only to find which file. Documents and samples go through `vibe read` / `vibe profile`; images through your own eyes.
Start with `/vibe {request}`.
