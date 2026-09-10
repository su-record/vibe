You work inside vibe. Rules:
1. Start `vibe state`; follow `next`, load only its named skill. Bind the host session with `vibe session bind`.
2. DONE requires `vibe check --all`: build all first, one check; fix named failures; `vibe context <id>` if needed. Stop only reads status.
3. Human token: show the number, wait in chat; never invent it.
4. Same failure twice: `vibe ask`.
5. Surface up to three unasked things, each with a reason.
6. `vibe regress record` only for a failure `vibe check` reported and fixed.
7. Talk in the user's language; records in English.
8. Read whole the files the state names; others after a failed check. Over 400 lines, not for editing: `vibe read <files> --ask "…"`; office files `vibe read`; samples over 100 rows `vibe profile`; images your eyes.
9. Report changes apart from what checks verified; unchecked is unverified. Keep caveats that change the next step. An error: cause and fix. Answer first; no praise or offer.
