# Personal FDE with one public entry

## Why
The user approved rebuilding vibe as their personal FDE in the existing npm-distributed Claude and Codex desktop integrations. Reduce verification and review overhead; keep project-appropriate skill research, installation and creation.

## What counts as success
- Only vibe is advertised as a skill and MCP tool; internal operations remain discoverable and usable.
- Context and guidance are read without indexing, model calls or task-state mutation.
- New extensions stay internal and preserve preview, installation, creation and usage behavior.
- Default hooks remove per-edit state queries, forced reading and Stop verification loops; explicit legacy permissions and evidence APIs remain compatible.
- Build, integration tests and npm package checks pass without paid model calls.

- Optimization guidance and bounded performance tools are internal; measurements do not execute arbitrary commands or models.
- Declared consequential outcomes require machine-checked failure and recovery prerequisites; omissions, failed checks and stale verifier evidence cannot yield DONE.
- Session knowledge is the person's opt-in: off by default; when on, a turn that changed project files or the configured number of conversation turns gives the working model one knowledge turn, without reading transcripts or starting a model; excluded folders are never recorded; repeated procedures become offered skill drafts unless the person allows creation. Turning it on connects the wiki to Obsidian without a path: the vault in use when there is one, otherwise a ready vault that is listed once Obsidian has run.
- Each project keeps its own page even when folder names repeat; a vibe project's shared knowledge appears in the same vault through a link (never into a synced wiki), knowledge the team needs is written into the project and the rest stays personal, and the brief and context read the project's own page. Every shared page stays reachable from the wiki's index without the model: vibe keeps a marked list on the project page and the page's line in the index. Before saving, the model finds the pages a subject touches by their title, aliases, tags, summary and text without a model or index, updates the page that holds it, and gives each page a summary, type, tags and aliases so later searches and links connect it.
- The knowledge base serves the person's FDE, read by the model: while session knowledge is on, a private, masked, 30-day journal of prompts and shell outcomes per project shows the person's words and repeats; the knowledge turn works from it, records unsaid defaults and proposes at most one improvement fitted to how the person works; the session start asks the model to look up decisions, methods and problems before choosing; superseded and archived pages rank below current ones. The journal costs little while off and records nothing in excluded folders.

## Constraints
- Preserve existing desktop transports and registration, historical records and user-modified skills.
- No new branch, worktree, live installation, publish or paid benchmark.
- Local tests do not establish desktop GUI behavior or measured token savings.

Automatic risk signals must prevent execution/completion without matching path/action coverage, including changes after approval and commits during a task. Diagnostics should name missing work and existing check candidates.
