# vibe — your personal FDE

Use vibe inside Claude or Codex to understand your work, solve the actual problem, connect existing tools and deliver a result you can use. Vibe retains useful project context and personal decisions across tasks.

```bash
npm i -g @su-record/vibe
```

In your connected host, start with `/vibe` and describe the work. Vibe is the only public skill. It uses the current host model; it does not start a separate planning model or reviewer by default.

## Work with your context

Vibe checks relevant project rules and existing decisions before asking questions. It uses installed tools first, finds a missing capability when needed, implements the useful outcome and verifies actual behavior. A clear task requires no additional interview, new worktree or approval ceremony.

Project knowledge remains in `.vibe/knowledge`; personal knowledge in `~/.config/vibe/knowledge`. A compact internal brief lists relevant places to read without indexing the repository, running tests or calling another model. Notes provide context, not authority to send, publish or delete.

## One entry, internal capabilities

Workflow and antislop guidance are local resources loaded only for the task at hand. Code, design and language guidance is applied during authoring; it does not automatically trigger editorial agents. Independent model review is optional and should target a concrete need.

Skill discovery, installation and creation are retained. Vibe first checks the host's capabilities and installed project skills. If an actual gap remains, it researches a suitable skill, previews installation or creates a reusable procedure. New project skills live under `.vibe/skills/installed` and are loaded through their registry instead of appearing as extra host commands. Existing user skills are not removed merely because they have similar names.

Use meaningful existing tests and required repository checks. Do not repeat unchanged verification merely to advance a workflow stage. Recorded machine verification, user acceptance and measured business value remain distinct.

## Existing desktop connections

- Claude Code uses the local npm plugin, with one entry under `skills/vibe`.
- Codex CLI and the desktop app use the existing personal marketplace registration and assembled plugin. Restart the app after installing an updated plugin.
- Claude Desktop uses the existing MCPB transport. Build it with `vibe plugin mcpb --out vibe.mcpb`, open it in the app and select the project. The tool catalog exposes one `vibe` tool; internal operations are discovered on demand. Its existing CLI operations are retained. Code editing requires tools available in the host; the MCPB itself does not add a general-purpose shell.
- Hermes and clients without plugin registration receive the single entry through the existing home installation fallback.

`vibe status` reports installation state; `vibe setup` repairs it; `vibe update` updates it. Queries never reinstall plugins. The npm package includes internal guidance and runtime code, while the assembled plugin remains small.

## Compatibility and diagnostics

The existing low-level intent, check, evidence, research and skill commands remain available for integrations and old projects. `vibe --help-internal` and `vibe internal tools` list them. Users need not operate the task state machine themselves.

Old strict token policies remain opt-in compatibility behavior. The ordinary personal FDE flow reuses chat authority and host permissions without issuing six-digit tokens. An imported executable check still needs valid local execution consent before the legacy runner executes it.

Default installed hooks no longer query state after every edit or police file-reading style. Stop runs no checks and does not force a new verification loop in the personal workflow. Explicit legacy APIs retain their original evidence rules; old unmet release work is never relabelled as completed.

Upgrades remove only unchanged bundled legacy skills from home surfaces. Modified copies are preserved. Existing project skill registry entries retain their paths; newly installed skills use internal storage. Historical measurements remain historical and do not establish savings for this rebuild.

## Validation

Build and tests: `npm run check`. Packaged surface: `node checks/personal-fde.js`. These use local fixtures; no model call is required. Desktop GUI behavior and real-session token/latency improvements require separate validation on the installed candidate.
