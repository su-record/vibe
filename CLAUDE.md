# vibe 4 (development repository)

This repository is vibe 4 itself. vibe 4 develops vibe 4 — the intent and scenarios in `.vibe/` are this repository's definition of done.

- Build `npm run build` · test `npm test` · both `npm run check`
- Verdict: `vibe check --all` (needs dist: `node dist/cli.js check --all`)
- Limits: no file over 400 lines (`checks/loc.js`; the total is free to grow), always-on card (`card.md`) ≤ 1KB, six common skills ≤ 300 lines in total — past these it is vibe 3 again
- Language: every record, comment, message and document is English; the model talks to the user in the user's language
- Design: the session artifact "vibe 4 설계안" is the source of the intent

<!-- vibe:start -->
You are working inside vibe. Rules:
1. Before changing anything, run `vibe state --json` and continue from it.
2. Nothing is done until `vibe check` says DONE. Never claim completion yourself.
3. When the harness asks for a human token (approval or an irreversible action), show the number and wait for it in chat. Never invent one.
4. If `vibe check` fails twice the same way, stop and `vibe ask`.
5. Surface at most three things the user did not ask about, each with a reason from the harness.
6. Record any failure you fixed with `vibe regress record`.
7. Talk to the user in the user's language. Write every record (intent, scenarios, inbox, knowledge, docs) in English.
Start with `/vibe {request}`.
<!-- vibe:end -->
