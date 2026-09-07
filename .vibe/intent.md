# vibe 4 · 4.1.16 — a code review reads what changed and what depends on it, not the whole directory

## Why
`review` with `pack: code` (and `pack: design`) on a directory sends every source file under it to both reviewers. On a real repository that is most of the token bill for nothing: the reviewers judge a change, and a change is a handful of files plus the files that import them. trace-mcp measured a PR review at 3,951 tokens against 13,595 for "the diff plus every touched file" by asking a dependency graph which symbols the change reaches. vibe does not need a graph or a dependency to get the first hop: git says what changed, and an import scan says who depends on it.

## What counts as success
- The `review` check gains `changed`: `true` means the working tree against `HEAD` (modified, added and untracked files, deleted ones dropped); a string is a git ref to diff against (`main`, `HEAD~3`, a sha). Only files under `path` count. Without a git repository the check fails with the reason `changed needs a git repository`.
- One hop of dependents joins the set: every source file under `path` whose import or require names a changed file by relative path (`./x`, `../x/index`, extension or not; Python `from .x import`, `from pkg.x import`, `import pkg.x`). Each `<file>` block carries `role="changed"` or `role="dependent"`, changed files first, and the bundle opens with the list of both.
- With nothing changed under `path` the check passes with the tail `nothing changed under <path> since <ref> — nothing reviewed`; it never sends the whole directory by accident.
- Text packs ignore `changed` (a manuscript is one file); validation accepts `changed` as `true` or a string.
- The collector's selection is unit-tested in a temporary git repository: a changed file, a file that imports it, a file that does not, an untracked file, a deleted file, a Python import; the ref form; the no-git failure; the nothing-changed pass.
- `vibe-scope` proposes `changed: true` on every `review` of a directory in a git repository; the six common skills stay ≤ 300 lines. README's check table names `changed`.
- Live: on this repository, a `pack: code` review bundle built with `changed: true` while `src/core/checks/source.ts` is modified lists that file as changed and `src/core/checks/review.ts` as dependent, and lists no file that neither changed nor imports a changed one — proven by the collector alone, no model.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, plugin tree current for 4.1.16, README status line carries `4.1.16`.

## Constraints
- No dependency, no index, no daemon: git and a regular expression over import lines. Deeper reach stays with tools built for it.
- The reviewers' verdict rule does not change.
- Every record is English; the model talks to the user in the user's language.
