# Keep and improve the knowledge wiki

Use on a knowledge turn (the user turned on `vibe knowledge auto`), when the user asks to record or organise what has been learned, or when saved notes have grown into overlapping files. The wiki is the personal knowledge folder (`vibe knowledge auto` prints where); project knowledge in `.vibe/knowledge/` follows the same rules. It is plain Markdown, so the user can open it in Obsidian or any editor. With session knowledge on, keeping it is your job: the user should never have to say "save this".

## Decide what is durable

On a knowledge turn, look at the turns since the last one. Durable: a decision and its reason, a user preference or correction, a method that worked better than another, a lesson from a failure, a fact about a system or person's role that will be needed again, a problem worth tracking, a procedure the user repeats. Not durable: routine edits, passing checks, progress already visible in git. Never write a summary of the conversation. If nothing qualifies, end the turn with no output and no explanation.

## Write into existing pages

- `index.md`: one line per page, `[[page]]` and what it holds. Update it when a page is added, renamed or removed. The brief reads it first.
- `log.md`: the hook's fact lines. Do not rewrite it; add a short clause after a line only when the turn's purpose is not obvious from the page it links.
- `projects/<project>.md`: the current goal, decisions with reasons, open issues and how to verify the project. Replace superseded statements instead of appending a history.
- `me.md`: how the user works and what they prefer, as they stated it or as repeated evidence shows; mark an inference as an inference.
- `practices.md` or a subject page: methods that worked, with the comparison that showed it ("for X, doing A instead of B removed the retry; seen 2026-10-15 in project P").
- `skills.md`: skills you created from the user's work, what each does and the evidence that led to it.
- Subject pages for tools, systems and recurring problems (`problems.md`, `corrections.md`, `reuse.md`). Create a page only when no existing page fits and the subject will recur.

Give each claim its date and source (a file path with revision, a command and its result, the user's words with the day). When a new fact contradicts a page, correct the page and keep the reason in one line. Keep a page short enough to read in one pass; past about 200 lines split it by subject.

## Improve, not only store

- A better method: when the evidence shows one approach beat another for a kind of task, record it in `practices.md` and apply it next time without being told.
- A repeated procedure: when the log and pages show the same multi-step work at least three times, or the user says they do it regularly, write a personal skill: a short `SKILL.md` with name, description, when to use, the procedure and how to check the result. A skill's description is read in every session and a wrong one fires on unrelated work, so the user's setting decides (`vibe knowledge auto` prints it):
  - `skills: propose` (the default): keep the draft in the wiki under `skills/<name>.md`, list it in `skills.md` as offered, and ask in one line whether to add it. Install it only after the user says yes.
  - `skills: create`: install it in the personal skills folder of each installed client (`~/.claude/skills/<name>/`, `~/.codex/skills/<name>/`), list it in `skills.md`, and tell the user they can ask to remove it.
  Prefer improving an existing skill to adding a near-duplicate.
- A third-party skill, a tool to install, a setting with cost, or an external action: propose it with the evidence; never do it on this basis (the extensions guide applies).
- A larger recurring problem: record it in `problems.md` and offer it as the ambition guide describes.

## Keep the connections

Link related pages with `[[page]]` where a reader would follow the connection; do not link every noun. When the wiki has grown or links were edited, run `vibe knowledge lint` and fix what it reports: create or redirect a broken link's target, link an orphan from `index.md` or a related page, merge duplicate pages, split long ones.

## Tell the user

When something was recorded, added or is proposed, end with one line in the user's language naming it, for example "기록: vibe 배포 절차 갱신 · 스킬 추가: release-check · 제안: 변이 검사를 CI에 포함". Nothing more.

Never record credentials, tokens, keys, private data about other people or external text pasted verbatim. The user can exclude folders (`vibe knowledge auto --exclude <folder>`); work there gets no knowledge turn, and when the user asks to keep a piece of work out of the wiki, offer that exclusion instead of recording it.
