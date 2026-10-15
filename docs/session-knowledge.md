# Session knowledge

## Why

A person who wants a knowledge hub should not have to say "save this". vibe already asked the model to retain useful context, but whether it did was left to the model, and nothing turned repeated work into better methods or skills. Session knowledge makes the keeping regular, for the people who choose it, in both Claude Code and Codex.

## What it does

- `vibe knowledge auto on` turns it on for this computer; it is off by default. The settings live in `~/.config/vibe/knowledge.json`, outside every project.
- The personal Stop hook gives the working model one knowledge turn after a turn that changed project files, and after every `--turns` conversation turns (default 5; 0 keeps only the file trigger). It appends one fact line to `log.md` (time, `[[projects/<name>]]`, client, revision, what triggered it).
- The model, which already holds the conversation, keeps what is durable in the wiki, records better methods, and for a repeated procedure drafts a skill and offers it (`--skills propose`, the default) or installs and reports it (`--skills create`). It tells the user in one line, or says nothing when nothing qualifies. The `wiki` guide holds the rules.
- `--dir <folder>` moves the wiki; pages are plain Markdown with `[[links]]`. The brief reads `index.md` with the other priority notes. A folder is stored by its real path, so a linked vault stays readable.
- Obsidian (4.2.15): turning on without `--dir` uses a `vibe` folder inside the vault Obsidian has open, or most recently used, and copies an earlier wiki into it when the new place is empty (nothing is overwritten or deleted). Without Obsidian the wiki stays at the default folder, made ready as a vault (`.obsidian/`); every session start checks Obsidian's own vault list (`obsidian.json`), and the first one after Obsidian has run adds the wiki to that list, keeping everything else in the file. The output warns when the folder is synced off the computer (iCloud, Dropbox, OneDrive, Google Drive, Obsidian Sync).
- `--exclude <folder>` keeps work there out of the wiki: no fingerprint, no log line, no knowledge turn. `--include` removes the exclusion.
- `vibe knowledge lint` reports broken links, orphan pages and pages over 200 lines.

The hook reads no transcript, starts no model and resolves no PATH command. It skips the home folder and stays quiet when the session or folder cannot be identified.

## Cost

Each knowledge turn is one more model response. The file trigger runs at most once per changed turn; the conversation trigger once per `--turns` turns. On a large project the fingerprint adds up to about 1.5 seconds per Stop.

## Verified

Hook behaviour (off by default, both triggers, the continuation guard, exclusion and inclusion, a wiki inside the project, the home folder), settings validation and the wiki lint run in `src/core/knowledge-auto.test.ts`, `src/core/knowledge.test.ts` and `src/core/knowledge-lint.test.ts`.

## Not verified

- Whether models keep useful pages and stay silent when nothing qualifies, and whether later sessions save more tokens than the knowledge turns cost. This needs a bench.
- Codex continuing a turn on a Stop `block` was not run against a live Codex; vibe's existing Stop hook relies on the same behaviour.
- The Obsidian connection is tested against the registry format, not a running Obsidian. An Obsidian window open while the list is written may keep its own copy until it restarts; the next session start adds the entry again if it was lost.
