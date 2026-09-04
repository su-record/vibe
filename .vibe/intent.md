# vibe 4 · 4.1.1 — `vibe update`

## Why
The update was an npm command the user had to know. `vibe update` asks the registry, installs the newer version, and lets the new binary re-register the plugins; `vibe status` says when a newer version exists. The first-run message also stops claiming "card, skills and hook" when the client is in plugin mode.

## What counts as success
- `vibe update --check` reports installed and latest; `vibe update` installs only when the registry is newer and prints the manual command when npm fails; without a registry it says so instead of guessing.
- `vibe status` carries an `update` line when a newer version exists; `VIBE_OFFLINE` skips the lookup.
- The first-run line names the mode per client.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- npm is called only from `vibe update`; no hook or status command ever installs anything.
- Every record is English; the model talks to the user in the user's language.
