# vibe 4 · 4.1.3 — the bundle finds the CLI without the shell's PATH

## Why
A desktop app is launched without the terminal's PATH (macOS: /usr/bin:/bin), so the first real install of the 4.1.2 bundle would report "vibe not installed" on a machine that has it. The server now looks where npm puts binaries and accepts a path from the install screen.

## What counts as success
- With PATH empty, the server finds the CLI through the `vibe executable` install setting and names it in the initialize instructions; without either it says "CLI not found" with the install command.
- The manifest carries the optional `vibe_cli` file setting and passes it as VIBE_CLI.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- The search is a fixed list of usual npm prefixes and version managers; nothing is installed or written.
- Every record is English; the model talks to the user in the user's language.
