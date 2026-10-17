---
summary: "Developing vibe here: tests and dev CLI under a throwaway HOME, vibe check --all with the real home, hook read limits, Windows-safe fixtures."
type: method
tags: [development, testing, windows]
aliases: [dev setup, throwaway home, 개발 환경, 테스트 방법]
updated: 2026-10-16
---
# Developing vibe in this repository

- Run the dev CLI and tests with a throwaway home: `HOME=<tmp> USERPROFILE=<tmp> node dist/cli.js …` / `npm run check`. Any `node dist/cli.js` command runs client auto-setup, so with the real home it installs the unreleased plugin into Claude and Codex (`[vibe] set up claude (plugin x.y.z)`). Seen 2026-10-15 with `plugin build --check` during 4.2.16.
- `vibe check --all` needs the real home: under a throwaway home it stops at "local execution consent required", because the consent receipt lives in the real home.
- The repository's PreToolUse hook blocks commands that read part of a protected file (`grep -n`/`-A` on source; a command combining `sed -i` and `grep -c` was blocked too). Use the Read tool for whole files, the Edit tool for source edits and `grep -l` only to locate.
- Test fixture names must be valid Windows file names (no `| < > : " ? *`); the Windows CI job creates them for real. `a[b]|c` failed 4.2.16's first PR run.
- Editing a scenario's verifier file (a listed test) after `vibe approve` withdraws the local consent: `vibe check --all` stops until the user approves again in chat. Fix verifier tests before asking for approval.
- A test that spawns many CLI processes needs its own timeout (`it(..., 30000)`): `vibe check --all` runs the mutation scenario in parallel, and the 5 s default failed knowledge-auto test 3 once (r-26, 2026-10-16) though it passes alone in about 1 s.
- A `not.toContain('<word>')` on hook output fails when the temporary fixture path holds that word (`vibe-journal-…` contains "journal"); assert on a phrase the path cannot hold, such as the command name (4.2.18, 2026-10-17).
