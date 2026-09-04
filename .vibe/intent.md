# vibe 4 · phase 5 — the repository is the plugin

## Why
Installing with npm and letting the first command write the client home works, but every client already has a marketplace and users expect one line there. vibe 3 published three trees by hand and they drifted. Here one generator writes every marketplace surface from package.json, the SessionStart hook carries the card and the CLI, and a drift check is a gate.

## What counts as success
- `vibe plugin build` writes `.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/marketplace.json`, `hooks/hooks.json` and `hooks/codex-hooks.json` from package.json; `--check` exits 1 on any difference and the committed tree is current.
- The plugin SessionStart hook hands the card to the model, reports the CLI version, installs the CLI with npm when it is missing or older, and stays silent when the npm install already owns the client; the plugin notify hook steps back the same way.
- Hermes is a client: `~/.hermes` gets the card in SOUL.md and the six skills, no hook; `hermes skills install su-record/vibe/skills/<name>` works because the repository keeps the agentskills.io layout.
- The local Codex tree (`vibe plugin install`) is assembled from the same generator.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines.

## Constraints
- Manifests are never edited by hand; package.json is the only version and description source.
- The plugin installs nothing but the vibe CLI itself, and says so in the session context.
- Screens the harness cannot see (Claude Code plugin list, Codex, ChatGPT desktop) are human items.
- Every record is English; the model talks to the user in the user's language.
