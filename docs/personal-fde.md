# Personal FDE rebuild

The user wants a personal FDE inside the existing Claude and Codex desktop integrations, distributed through npm. Vibe should understand their work, choose useful interventions, implement them with existing tools, verify actual behavior and retain decisions for the next task.

## Accepted behavior

- Expose only the vibe entry skill. Workflow and antislop instructions are internal, loaded on demand without a model call.
- Preserve npm installation, Codex registration and Claude Desktop MCPB transport. Expose one MCP tool with discoverable internal operations.
- Reuse project and personal knowledge. A brief reads relevant context without running tests, indexing the repository, creating records or invoking another model.
- Preserve skill research, installation and creation. Use them for an identified capability gap, not as mandatory steps for every request.
- Reuse existing user authority, work in the current checkout and ask only about consequential missing information. No automatic review, new worktree or token exchange for ordinary work.
- Keep the existing low-level verification, consent and strict-policy compatibility APIs for old projects. Do not silently relax an explicitly configured policy or claim legacy DONE for a task outside its contract.
- Keep historical evidence intact. No publishing, live client installation, deletion of existing user worktrees or paid model evaluation is part of this implementation.

## Verification

Run the build and unit/integration suite once after implementation, plus packaged-surface checks. Test the generated plugin contents, home migration, MCP discovery and dispatch, internal guide access, bounded read-only context and retained skill operations. Use local fixture homes and fake tools; do not start a model to test the routing.

Real desktop GUI behavior and latency/token improvements require later measurements on the installed candidate. Local transport tests establish protocol and packaging behavior only.

## Complexity and performance contract

Required verification must not be weakened to reduce latency. Optimize the work around it: module loading, repeated reads and redundant execution. Do not introduce a second state machine, review pipeline or persistent daemon to accelerate the existing one without measured evidence.

- Load CLI command modules on demand. Help, version and internal guidance must not initialize installation, research or check adapters. Existing command arguments, errors and authority checks remain the same.
- Keep one verdict implementation. The desktop transport and CLI should route to it rather than maintain independent completion rules.
- Before reusing check evidence, account for the contract, source inputs, execution configuration and prerequisite results. Until this dependency model is complete, retain conservative invalidation; a faster stale PASS is incorrect.
- Keep retained legacy APIs behind the same dispatch boundary. Moving files out of public discovery alone does not remove their maintenance cost. Retire compatibility paths only after mapping callers and defining migration behavior.
- Measure local process latency separately from model tokens, reviews and end-to-end task time. `node scripts/benchmark-startup.mjs` reports ten fresh-process samples per command after two warmups, with filesystem caches warm. It runs no models or checks and reports medians without a machine-dependent pass threshold.

CLI modules load on demand. Internal performance report/startup operations and the optimization guide now provide bounded, on-demand measurements. Risk-bearing scenarios require impact/recovery descriptions and machine-check prerequisites through the existing parser and scheduler. The check engine detects sensitive changed paths and mutating commands before execution and before completion, independent of declarations. A private task Git baseline survives commits and repairs; missing baselines and non-Git projects inspect all paths conservatively. Additive project path rules are bound into execution consent. Internal risk diagnostics provide existing check candidates. Complete semantic discovery of every domain risk is not provided. Finer evidence reuse, shared transport dispatch and legacy-engine retirement remain follow-up work.
