# vibe 4 · phase 2 — Codex CLI and ChatGPT desktop adapters

## Why
Phase 1 works only in Claude Code. The point of vibe 4 is that the same `.vibe/` state is picked up by any client: approve in Claude Code, build in Codex, prove in ChatGPT desktop. Codex reads `AGENTS.md`, `.codex/skills` and a native `.codex/hooks.json`; ChatGPT desktop and Codex share one plugin format registered through `~/.agents/plugins/marketplace.json`.

## What counts as success
- `vibe init --client codex` installs the card into AGENTS.md, the six common skills into `.codex/skills`, and the notification hooks into `.codex/hooks.json`.
- `vibe plugin install` assembles a plugin tree (manifest · skills · hooks) and registers it in the personal marketplace; `vibe plugin status` reports drift between the tree and the package.
- The same intent approved under one client continues under another: the ledger shows both clients and the state carries over.
- Phase 1 gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines.
- A human confirms the plugin actually appears in ChatGPT desktop — the harness cannot see that screen.

## Constraints
- The plugin tree carries no `node_modules`: its hooks call the globally installed `vibe` CLI.
- Codex hooks are notification-only, like Claude's. The verdict stays `vibe check`.
- Every record is English; the model talks to the user in the user's language.
