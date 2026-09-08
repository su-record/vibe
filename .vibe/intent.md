# vibe 4 · 4.1.18 — research has a time window: what moved in the last 30 days ranks first

## Why
`vibe research` ranks GitHub candidates by keyword match, recency of the last push, stars and licence, with no notion of a window. What the scope stage needs to know is whether a library or an API moved recently — a release, a burst of commits — before an intent is written against it. last30days-skill (61k stars) is built around exactly that window, with one principle worth taking as it is: evidence outside the window is demoted, never dropped. The rest of it — eighteen sources, keys, a doctor — stays outside vibe.

## What counts as success
- `vibe research` takes `--days N` (default 30). For every repository candidate the harness asks GitHub for the latest releases (`/repos/{o}/{r}/releases?per_page=3`) and, when there is none inside the window, the latest commit on the default branch (`/repos/{o}/{r}/commits?per_page=1`); one request per candidate, at most two.
- A candidate carries `recent: { releases: [{ tag, at }], lastCommitAt, inWindow }`. Its `why` says what moved: `released v4.2.0 12 days ago` · `3 releases in 30 days` · `last commit 4 months ago, no release in 30 days`.
- Ranking: candidates with activity inside the window rank above every candidate without, whatever their score; inside each group the score orders as before. Nothing is dropped for being old.
- The note under `.vibe/knowledge/research/` records the window (`last 30 days`, the cutoff date) and each candidate's latest activity; the cache key includes the window.
- Skill candidates from the catalogs (a tree fetch, no dates) are unchanged and rank by score after the repository groups are formed.
- `vibe-scope` step 4 says the research window in the approval message ("what moved in the last 30 days"); the six common skills stay ≤ 300 lines. README's research paragraph names `--days` and the demote-never-drop rule.
- Tests with the fixture client: a repository released 12 days ago ranks above a higher-scored one whose last commit is four months old; the `why` lines read as specified; `--days 7` moves the 12-day release out of the window and the ranking follows; a repository whose releases request fails still lists with `lastCommitAt` from the commits request; the cache key changes with the window.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, no catalogue, plugin tree current for 4.1.18, README status line carries `4.1.18`.

## Constraints
- GitHub only, through the client vibe already has; no key beyond the optional token, no new source, no new dependency.
- Every record is English; the model talks to the user in the user's language.
