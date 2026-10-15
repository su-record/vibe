# Developing vibe in this repository

- Run the dev CLI and tests with a throwaway home: `HOME=<tmp> USERPROFILE=<tmp> node dist/cli.js …` / `npm run check`. Any `node dist/cli.js` command runs client auto-setup, so with the real home it installs the unreleased plugin into Claude and Codex (`[vibe] set up claude (plugin x.y.z)`). Seen 2026-10-15 with `plugin build --check` during 4.2.16.
- `vibe check --all` needs the real home: under a throwaway home it stops at "local execution consent required", because the consent receipt lives in the real home.
- The repository's PreToolUse hook blocks commands that read part of a protected file (`grep -n`/`-A` on source; a command combining `sed -i` and `grep -c` was blocked too). Use the Read tool for whole files, the Edit tool for source edits and `grep -l` only to locate.
