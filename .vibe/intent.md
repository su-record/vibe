# vibe 4 · phase 5 — the package is the plugin

## Why
One install, one runtime. `npm i -g` stays the only install; what the client sees is a plugin, because the package registers itself as a local plugin wherever a client CLI is present — Claude Code (directory marketplace + `vibe@vibe`), Codex/ChatGPT (personal marketplace + tree), Hermes (skills + SOUL.md). No public marketplace: a marketplace copy would need its own install path and vibe 3 showed how three paths drift. One generator writes every manifest and hook file from package.json and a drift check is a gate.

## What counts as success
- `vibe plugin build` writes `.claude-plugin/`, `.codex-plugin/`, `hooks/hooks.json` and `hooks/codex-hooks.json` from package.json; `--check` exits 1 on any difference and the committed tree is current; the manifests ship in the npm package.
- With the `claude` CLI present, setup registers the package directory as marketplace `vibe` and installs `vibe@vibe`; an older plugin is updated, a marketplace pointing elsewhere is re-pointed, nothing runs when current, uninstall unregisters. With the `codex` CLI present, setup assembles the tree, registers the personal marketplace and runs the two codex commands; the card stays in `~/.codex/AGENTS.md`. Without a CLI (or with `VIBE_NO_PLUGIN`) the home surfaces are written as before.
- The plugin SessionStart hook hands the card to the model and names the CLI version; it and the plugin notify hook stay silent when the client home already carries the npm surfaces.
- Hermes is a client: `~/.hermes` gets the card in SOUL.md and the six skills, no hook.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines.

## Constraints
- Manifests are never edited by hand; package.json is the only version and description source.
- The hooks never install anything; registration only ever runs the client's own plugin commands.
- Screens the harness cannot see (the Claude Code `/plugin` list, Codex, ChatGPT desktop) are human items.
- Every record is English; the model talks to the user in the user's language.
