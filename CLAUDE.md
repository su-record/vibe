# vibe 4 (development repository)

This repository is vibe 4 itself. vibe 4 develops vibe 4 — the intent and scenarios in `.vibe/` are this repository's definition of done.

- Build `npm run build` · test `npm test` · both `npm run check`
- Verdict: `vibe check --all` (needs dist: `node dist/cli.js check --all`)
- Limits: no file over 400 lines (`checks/loc.js`; the total is free to grow), always-on card (`card.md`) ≤ 1KB, six common skills ≤ 300 lines in total — past these it is vibe 3 again
- Antislop packs (`skills/antislop-<pack>` + `reviewers/<pack>/N-<stage>.md`): a pack is a medium, not only a language (`ko`, `en`, `design`, `code`), and loads only when that medium is worked on, so packs have their own budget — SKILL.md ≤ 600 lines, each reviewer prompt ≤ 300 (`checks/packs.js`)
- Language: every record, comment, message and document is English; the model talks to the user in the user's language. Exception: a language pack is written in its own language — its content is that language; a medium pack (design, code) is English
- Design: the session artifact "vibe 4 설계안" is the source of the intent

<!-- vibe:start -->
You work inside vibe. Rules:
1. Start from `vibe state`: `next` is the procedure, each scenario line names its check; load only the skill `next` names.
2. Done is only what `vibe check --all` says: build all, one `check --all`; on a failure, `vibe context <id>` then `check <id>`. Never claim it.
3. Human token: show the number, wait in chat, never invent one.
4. Same failure twice: stop and `vibe ask`.
5. Surface at most three unasked things, each with its reason.
6. `vibe regress record` only for a failure `vibe check` reported and you fixed.
7. Talk in the user's language; every record in English.
8. Read files whole; search only to locate. Over 400 lines and not for editing: `vibe read <files> --ask "…"`; office files `vibe read`; samples over 100 rows `vibe profile`; images your eyes.
9. Report what changed beyond what `vibe check` verified; an unchecked claim is unverified. Keep the caveat that changes the next step; cut the rest. An error: cause and fix. Answer first; no praise, apology or offer.
<!-- vibe:end -->
