# vibe 4 · 4.1.2 — the Claude desktop app through an MCP Bundle

## Why
The Claude desktop app has one plugin form, the MCP Bundle. Its model has no shell, so the bundle is a cable to the `vibe` CLI on the machine: interview, intent and scenarios, one approval, the verdict, inbox and ledger — the FDE work that needs no code editor. Building stays with Claude Code, Codex and Hermes on the same `.vibe/`.

## What counts as success
- `vibe plugin mcpb [--out file]` writes a valid zip with manifest.json (spec 0.3, version and description from package.json, a directory `user_config` for the project folder), server/index.js and README; an independent zip reader validates it.
- The server speaks MCP over stdio without any dependency: initialize, tools/list, tools/call; each tool runs `vibe … --json` in the chosen folder and returns the JSON; an unknown tool is a JSON-RPC error; a missing CLI is reported with the install command.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- No MCP SDK: the protocol subset is three methods and the bundle stays dependency-free.
- The bundle installs nothing and never writes files itself; every side effect is a `vibe` command.
- The app's screen cannot be seen from Linux; installing the bundle in the Claude desktop app is a human item.
- Every record is English; the model talks to the user in the user's language.
