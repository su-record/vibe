# vibe for the Claude desktop app

An MCP Bundle (`.mcpb`) that hands the `vibe` CLI to Claude for macOS and Windows. Build it with `vibe plugin mcpb --out vibe.mcpb`, open the file in the Claude app, pick the project folder, done. The bundle carries no dependency and installs nothing: every tool runs `vibe … --json` in that folder, so the npm package must be on the machine (`npm i -g @su-record/vibe`).

This surface is for the FDE work that needs no shell: the interview, the intent and scenarios, the approval, the verdict (`vibe_check`), the inbox and the ledger. Building the code stays with Claude Code, Codex or Hermes, which pick up the same `.vibe/` state.
