# System design in the personal FDE

An FDE does more than finish one task: it shapes how the user's recurring work runs. Until now every internal guide worked at the level of one task or one capability, and several warned against building. That left no criterion for the case where the connections between tasks are the problem. The `system` guide fills that gap without changing the default: a single task is still solved directly.

The guide maps the user's recurring work from evidence, places each piece on the lightest mechanism that holds it (existing capability, script or check, skill, schedule, hook or interface extension, agent team, the person), designs the handoffs and failure visibility, and puts one piece into use before the next. The map lives in one existing knowledge note and grants no permission.

Three rules come from the dynamic-workflow work in `su-record/vica` (its splittability gate and design section 21): automate repetition only where a machine decides completion; separate machine-checked output from what a person must read; and split work only at zero coupling, where coupling is a shared write target, a write that another piece reads, or a declared dependency. The source for those rules cites figures from a video summary that vica itself marks as unverified; the guide carries the rules, not the figures.

Agent teams are one placement among several. When a team-design skill such as `revfactory/harness` is installed, the guide delegates generation to it and keeps the judgment vibe alone holds: whether a team is warranted for this user's work, and whether the generated team produced a verified result. Compatibility of that skill with vibe has not been tested.

Validation covers guide delivery through the CLI and MCP name list, the entry's pointer to the guide, the stated boundaries (no design for a single task, lightest mechanism first, zero-coupling parallelism, one piece at a time, map is not permission) and the packed npm contents. These checks do not show that a model designs a good system for a real user; that needs actual use.
