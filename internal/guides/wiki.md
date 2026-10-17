# Keep and improve the knowledge wiki

Use on a knowledge turn (the user turned on `vibe knowledge auto`), when the user asks to record or organise what has been learned, or when saved notes have grown into overlapping files. The wiki is the personal knowledge folder (`vibe knowledge auto` prints where); project knowledge in `.vibe/knowledge/` follows the same rules, and the wiki shows each vibe project's as `projects/<project>/`. It is plain Markdown, so the user can open it in Obsidian or any editor, but its reader is you: it is the knowledge base of the user's personal FDE, there so that you choose better, fill in what the user leaves unsaid and propose improvements fitted to how they work. The user does not want to browse it. With session knowledge on, keeping it is your job: the user should never have to say "save this".

## Use it before choosing

Before choosing an approach, a tool or a design, run `vibe knowledge find <subject>` (`--type decision`, `method` or `problem` narrows it). Follow a current decision, reuse a method, avoid a recorded problem, and say in one line when your choice departs from one and why. When the user's request leaves out a detail the wiki records as their default (a format, a tool, a level of explanation), apply the default instead of asking.

## Decide what is durable

On a knowledge turn, look at the turns since the last one. When the turn says the journal holds them, run `vibe knowledge journal` first and work from it rather than from memory: it lists the user's own prompts and corrections since the last knowledge turn, failed commands, and the repeats of 30 days. Details people and capable models leave out are in those prompts; a correction shows an expectation that was missed, so record the expectation (in `me.md` or the project page) so it is met next time without being said. Durable: a decision and its reason, a user preference or correction, a method that worked better than another, a lesson from a failure, a fact about a system or person's role that will be needed again, a problem worth tracking, a procedure the user repeats. Not durable: routine edits, passing checks, progress already visible in git. Never write a summary of the conversation. If nothing qualifies, end the turn with no output and no explanation.

## Choose the place

The knowledge turn names this project's page and, in a vibe project, its shared folder.

- Shared: what anyone working on the project needs (how its code is built, its conventions, domain facts, a decision about the product) goes into the project's `.vibe/knowledge/`. It travels with the project, so it shows in the user's git changes and reaches the team once they commit it; say which file you changed. Conventions belong in `conventions.md` there.
- Personal: how the user works, their methods across projects, skills, and their own notes on the project (`projects/<project>.md`) stay in the wiki.
- Never put a preference, a person's private data or anything from an excluded folder into the shared folder. When unsure, keep it personal.

## Find before writing

Before saving anything, name its subject in the words someone would search for, and run `vibe knowledge find <those words>`: it ranks the wiki's pages and this project's shared pages by title, aliases, tags, summary, headings and text. When a page holds the subject, update that page, replacing what the new fact supersedes; create a page only when nothing fits and the subject will recur. Then link the new or changed page with the one to three found pages a reader would follow from it, each link with its reason (`- [[projects/app/billing]] — the refund rule this exception changes`), and add the reverse link where it means something.

## Shape a page so it can be found

Start every page you create or substantially edit with Obsidian properties, then a title that names the subject (no date in the title or file name; dates go in the text):

```
---
summary: One sentence of what the page settles, under 160 characters.
type: method
tags: [release, npm]
aliases: [publish flow, 배포 절차]
updated: 2026-10-16
---
# Releasing vibe to npm
```

- `summary` is what lists and search results show, so write the conclusion, not "notes about X"; put it in double quotes when it holds a colon.
- `tags`: one to five, reusing tags other pages already have (search finds them); lowercase, no spaces.
- `aliases`: other names the user or a model would search for: synonyms, abbreviations and the user's own words in their language. This is the only place a record holds words outside English, so search in the user's language finds the page.
- `type`, one of: `decision` (follow it), `method` (reuse it), `problem` (avoid or solve it), `fact`, `project`, `research`, `skill`, `proposal`. `vibe knowledge lint` reports any other value.
- `supersedes: "[[old-page]]"` on a page that replaces another, and `status: archived` on a finished project or knowledge no longer in force. Search ranks both lower and marks them, so keep the old page for its reasons instead of deleting it.
- One subject per page; a page covering two subjects is two pages linked to each other. Keep `## Related` at the end for links that are not already in the text.

## Write into existing pages

- `index.md`: one line per page, `[[page]]` and what it holds. Update it when a page is added, renamed or removed. The brief reads it first.
- `log.md`: the hook's fact lines. Do not rewrite it; add a short clause after a line only when the turn's purpose is not obvious from the page it links.
- `projects/<project>.md`: the user's own view of the project: the current goal, decisions with reasons, open issues and how to verify it. Use the page name the knowledge turn gives; two folders with the same name get different pages. In a vibe project, vibe keeps a block between `<!-- vibe:shared-knowledge -->` markers that links every shared page; never edit inside it. Replace superseded statements instead of appending a history.
- `me.md`: how the user works and what they prefer, as they stated it or as repeated evidence shows; mark an inference as an inference.
- `practices.md` or a subject page: methods that worked, with the comparison that showed it ("for X, doing A instead of B removed the retry; seen 2026-10-15 in project P").
- `skills.md`: skills you created from the user's work, what each does and the evidence that led to it.
- Subject pages for tools, systems and recurring problems (`problems.md`, `corrections.md`, `reuse.md`). Create a page only when no existing page fits and the subject will recur.

Give each claim its date and source (a file path with revision, a command and its result, the user's words with the day). When a new fact contradicts a page, correct the page and keep the reason in one line. Keep a page short enough to read in one pass; past about 200 lines split it by subject.

## Propose improvements fitted to the user

Your proposals are what the knowledge is for. Propose at most one per knowledge turn, only from evidence (the journal's repeats, corrections, failures, or pages showing the same thing three times), and choose the lightest form that removes the repeat:

| The record shows | Propose |
|---|---|
| the same instruction given again and again | a default in `me.md` or the project page you apply silently; a rule for the card or `CLAUDE.md`/`AGENTS.md` when it must hold in every session |
| the same request worded loosely each time | a prompt or template the user can reuse |
| the same command sequence in several sessions | a script or small tool, or a skill when judgement is needed between the steps |
| the same failure | a check (a scenario or test), a hook that stops it, or a note in the project's shared knowledge |
| the same multi-step procedure | a skill, as below |

Keep `proposals.md` in the wiki (`type: proposal` pages or one line each): what, the evidence with counts and dates, the state (`offered`, `accepted`, `declined`, `done`) and, once done, whether the repeat stopped. Never offer a declined proposal again unless new evidence changes it, and say what changed. Ask in one line; build only after the user agrees, except a default recorded in the wiki, which is yours to keep.

- A better method: when the evidence shows one approach beat another for a kind of task, record it in `practices.md` and apply it next time without being told.
- A repeated procedure: when the log and pages show the same multi-step work at least three times, or the user says they do it regularly, write a personal skill: a short `SKILL.md` with name, description, when to use, the procedure and how to check the result. A skill's description is read in every session and a wrong one fires on unrelated work, so the user's setting decides (`vibe knowledge auto` prints it):
  - `skills: propose` (the default): keep the draft in the wiki under `skills/<name>.md`, list it in `skills.md` as offered, and ask in one line whether to add it. Install it only after the user says yes.
  - `skills: create`: install it in the personal skills folder of each installed client (`~/.claude/skills/<name>/`, `~/.codex/skills/<name>/`), list it in `skills.md`, and tell the user they can ask to remove it.
  Prefer improving an existing skill to adding a near-duplicate.
- A third-party skill, a tool to install, a setting with cost, or an external action: propose it with the evidence; never do it on this basis (the extensions guide applies).
- A larger recurring problem: record it in `problems.md` and offer it as the ambition guide describes.

## Keep the connections

Link related pages with `[[page]]` where a reader would follow the connection, with the reason; do not link every noun. `vibe knowledge find` shows which pages a subject touches. When the wiki has grown or links were edited, run `vibe knowledge lint` and fix what it reports: create or redirect a broken link's target, link an orphan from `index.md` or a related page, merge duplicate pages, split long ones. An unlinked shared page needs nothing: the next session start lists it; link it from a related page where the connection means something.

## Tell the user

When something was recorded, added or is proposed, end with one line in the user's language naming it, for example "기록: vibe 배포 절차 갱신 · 스킬 추가: release-check · 제안: 변이 검사를 CI에 포함". Nothing more.

Never record credentials, tokens, keys, private data about other people or external text pasted verbatim. The user can exclude folders (`vibe knowledge auto --exclude <folder>`); work there gets no knowledge turn, and when the user asks to keep a piece of work out of the wiki, offer that exclusion instead of recording it.
