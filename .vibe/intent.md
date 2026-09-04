# vibe 4 · 4.1.8 — spec skill names; `.vibe/` means one thing; the harness reviews human-read text (antislop)

## Why
Three changes, one release (4.1.8 is on PR #122, not yet published).

Antislop: the user wrote a Korean writing skill that strips AI clichés and translationese, with two reviewer agents (copy editor, chief editor) that return only PASS or a REJECT list. Its judging half is exactly the harness's job — the model must not say "done" about its own prose — so vibe carries it as a check type and bundles the writing skill as a language pack. No separate plugin: vibe is the only home.

Skills: the Agent Skills grammar allows only lowercase letters, digits and hyphens in a skill `name`, and the name must equal its directory. Five of the six common skills carried a dot; the repository also tracked a 4.0.2-era Korean copy of the six under `.claude/skills/`, which shadowed the plugin's current skills whenever vibe developed vibe.

Project root: two pieces of code used `.vibe/` with different meanings. The Codex/ChatGPT plugin tree lived at `~/.vibe/plugin/vibe`, assembled by every command's self-repair, so every user had a `~/.vibe/`. `findProjectRoot` took the nearest ancestor holding a `.vibe/` directory without looking inside. Any project under the home without its own `.vibe/` therefore resolved to `$HOME`: the first `intent draft` wrote its records into `~/.vibe/`, `run` checks could not find `./scripts/...` (exit 127), two projects under the home shared one intent, state and ledger, and `vibe state --json` had no `root` field to reveal it. The user hit exactly that.

## What counts as success
- A `review` check type: `check: { type: review, path, lang?, contract?, evidence? }`. The harness itself runs the language pack's reviewers in order (copy editor, then chief editor) through the client CLI (`claude -p`, else `codex exec`; `VIBE_REVIEW_CMD` overrides, used by tests); a stage passes only when the whole trimmed reply is exactly `PASS`; anything else fails with the reply in `tail`. Two identical failures in a row make STUCK as with every check. The scope skill marks it `⚠ model-judged` in the approval message.
- Language is detected from the file when `lang` is absent (Hangul share → `ko`, Latin letters → `en`); an unknown language fails the check with a clear reason.
- The package carries two language packs: `skills/antislop-ko` and `skills/antislop-en` (SKILL.md + references each) with `reviewers/{ko,en}/{copy-editor,chief-editor}.md`. The English pack keeps the Korean pack's structure and principles; only the language section (agreement, modifiers, nominalisation, passive, hedging, spelling variant, English AI clichés) is written for English. Each pack is installed with the six common skills in every client (plugin tree, home copies, Codex agents as TOML under the plugin), but is not counted among the six. Each pack is at most 600 lines per SKILL.md and at most 300 lines per reviewer prompt.
- `vibe-scope` proposes a `review` scenario when a success condition names human-read text (blog, column, report, script, speech, article); the six common skills stay at most 300 lines in total.
- CLAUDE.md records the two new rules: language packs have their own line budget and are written in their language.
- The six common skills are `vibe`, `vibe-discover`, `vibe-scope`, `vibe-build`, `vibe-prove`, `vibe-handoff`; every `name` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and equals its directory; none of the six is tracked under the repository's `.claude/skills`; the dotted directories of ≤ 4.1.7 in a client home are swept by the next command.
- The plugin tree lives under `~/.config/vibe/plugin/vibe`; a leftover `~/.vibe/plugin` from ≤ 4.1.7 is removed by the next command, and an emptied `~/.vibe/` goes with it, so the home never looks like a project.
- `findProjectRoot` accepts a `.vibe/` only when it holds a record (`state.json`, `intent.md`, `scenarios.yaml`, `ledger.jsonl` or `config.json`); it stops at the first ancestor containing `.git`; it never returns the home directory unless the start is the home; without a match it returns the start directory so the first record creates `./.vibe`.
- `vibe state --json` carries `root`; when the root is a strict ancestor of the current directory, `notices` says so; `vibe status` keeps `project.root`.
- A `run` check whose exit is 127 (command not found) appends the working directory to its `tail`; the README says the default `cwd` is the project root.
- Regression tests cover: a project folder under a home that carries only the plugin store resolves to the project folder; search stops at a `.git` root; a `.vibe/` with `state.json` wins over an empty one; the plugin store migration.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, six common skills ≤ 300 lines, plugin tree current for 4.1.8.

## Constraints
- The entry skill stays `vibe`; skill bodies change only in the names they reference (plus the one review line in vibe-scope).
- A `review` check never edits the manuscript; it only judges. The Korean reviewer prompts are the user's text, moved verbatim except for skill and agent names; the English ones are drafted from them.
- Only the plugin store path and root discovery change; `.vibe/` layout inside a project stays as it is.
- Codex registration keeps working: the personal marketplace entry points at the new tree.
- Every record is English; the model talks to the user in the user's language.
