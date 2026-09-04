# vibe 4 · 4.1.8 — skill names by the Agent Skills spec, no stale copies in the repository

## Why
The Agent Skills specification (agentskills.io) allows only lowercase letters, digits and hyphens in a skill `name`, and the name must equal its directory. Five of the six common skills carry a dot (`vibe.discover` … `vibe.handoff`). Claude Code tolerates it; Codex and ChatGPT follow the spec. The repository also tracks a 4.0.2-era Korean copy of the six under `.claude/skills/`, which shadows the plugin's current skills whenever vibe develops vibe and breaks the English-only rule for records.

## What counts as success
- The six common skills are `vibe`, `vibe-discover`, `vibe-scope`, `vibe-build`, `vibe-prove`, `vibe-handoff`; every `name` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and equals its directory; cross-references inside the skill bodies use the new names.
- `.claude/skills/` in this repository carries only project skills (`example-settle`); none of the six is tracked there.
- A client home or plugin tree that still holds the dotted directories from ≤ 4.1.7 loses them on the next command (self-repair) and on uninstall; nothing else in that directory is touched.
- Version 4.1.8 in package.json and the three manifests; the README release line says what changed.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- The entry skill stays `vibe`; the user still starts with `/vibe {request}`.
- Skill bodies change only in the names they reference; procedures stay as they are.
- Every record is English; the model talks to the user in the user's language.
