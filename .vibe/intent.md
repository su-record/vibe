# vibe 4 · 4.1.7 — sweep the hooks vibe 3 left behind

## Why
A machine that had vibe 3 keeps hook entries in `~/.claude/settings.json`, `~/.codex/hooks.json` and a `notify` line in `~/.codex/config.toml` that point at `…/hooks/scripts/*.js`. Once that install is gone, Claude Code reports a missing script at every session start and stop. The user saw exactly that. vibe 4 now removes entries whose script no longer exists, on every command and on uninstall, and leaves every live hook alone.

## What counts as success
- Entries whose `hooks/scripts/*.js` file is missing are removed from both settings files and the codex notify line; live entries, other hooks and unrelated settings stay; a second sweep changes nothing.
- The sweep runs from `ensureGlobal` (every command) and `uninstallGlobal`.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- Only entries that reference a `hooks/scripts/` file that does not exist are touched; nothing else in the files changes.
- Every record is English; the model talks to the user in the user's language.
