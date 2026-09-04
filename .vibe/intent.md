# vibe 4 · 4.1.9 — Codex follows `vibe update`: the plugin Codex runs is read, compared and re-registered

## Why
`vibe update` installs the new package and lets the new binary re-register the plugins on its first command. For Claude Code this works: `registerClaude` reads the version Claude has installed, compares it with the package and runs `claude plugin update`. For Codex it never did. `codexRegistered` looks only at vibe's own tree under `~/.config/vibe/plugin/vibe` and at whether the personal marketplace has an entry *named* `vibe`; it never reads what Codex actually installed, and it never checks where the entry points. So a Codex plugin stays at the version it was first registered with, a marketplace entry still pointing at the ≤ 4.1.7 store `~/.vibe/plugin/vibe` (a path that no longer exists) passes as "registered", and `vibe status` prints the package version as the Codex plugin version — a claim, not a reading.

The user hit exactly that today: `vibe status` said `codex plugin 4.1.8`, `codex plugin list` said `4.1.7` from `/home/ubuntu/.vibe/plugin/vibe`.

## What counts as success
- `codexPluginVersion(home)` reads the version Codex has installed from its cache (`~/.codex/plugins/cache/<marketplace>/vibe/<version>/.codex-plugin/plugin.json`, highest version when several are present) and returns null when there is none.
- `pluginStatus` reports drift when the marketplace entry's `source.path` does not resolve to the current tree (`marketplace points at <path>`), not only when the entry is missing.
- `codexRegistered` is true only when the tree has no drift and the version Codex has installed equals the package version. A Codex cache that cannot be read (null) is not treated as stale — the marketplace and tree remain the verdict then, so a Codex build with another cache layout does not re-register on every command.
- `registerCodex`, when not current: assembles the tree, rewrites the marketplace entry, adds the marketplace to Codex, and — when Codex already holds an older version — removes the plugin before adding it again (Codex CLI has no per-plugin update; local marketplaces are refreshed by remove + add). The detail reads `updated <old> → <new>` or `registered vibe@<marketplace>`. A marketplace-add that fails only because the marketplace is already configured does not fail the registration.
- `clientStatus` for Codex reports `pluginVersion` from the Codex cache (falling back to the package version only when the cache is unreadable and the tree is registered) and `current: false` when Codex is behind, so `ensureGlobal` repairs it on the next command and `vibe update`'s follow-up `vibe status` shows the new version.
- Regression test: a home whose Codex cache holds an older plugin and whose marketplace entry points at `./.vibe/plugin/vibe` — status reports the old version and not current; `ensureGlobal` repairs Codex (marketplace rewritten to the new tree, `plugin remove` then `plugin add` logged); afterwards status reports the package version, current, and a second `ensureGlobal` runs nothing.
- Regression test: `pluginStatus` lists the marketplace-path drift when the entry points elsewhere.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, six common skills ≤ 300 lines, language packs within budget, plugin tree current for 4.1.9.
- The README status line carries a `4.1.9` entry.

## Constraints
- Claude Code registration does not change.
- No new dependency; the Codex cache is read from disk, no extra `codex` invocation for status.
- `.vibe/` layout inside a project and the plugin tree layout stay as they are.
- Every record is English; the model talks to the user in the user's language.
