# Design the user's operating system

Use when two or more recurring workflows feed each other, the same workaround recurs across tasks, or the user asks to turn their work into a system. A single task, a first attempt or an isolated edit needs no design: solve it directly. Designing is work the user pays for; start it only when the connections between tasks are the problem.

Map the work before choosing mechanisms. From the conversation, existing knowledge notes and accessible artifacts, list each recurring piece of work with its trigger, input, output, consumer, frequency, known failure and the point where a person decides. Use the fieldwork guide for meanings and exceptions you cannot see. Keep an unobserved step unknown; do not invent workflows to complete the picture.

Place each piece on the lightest mechanism that holds it, in this order: an existing capability (host tool, connector, installed skill, the environment's own tools); a script or check when the result must be identical every time; a skill when the procedure needs judgment and will be reused; a schedule when time triggers it; a hook or interface extension when it must happen regardless of what the model remembers; an agent team when roles need different expertise or separate context; the person when it needs judgment, authority or acceptance. Reuse outranks building. For every placed piece record its job, input and output, handoff to the next piece, human checkpoint, behavior on failure, verification and owner.

Apply three rules before any loop, fan-out or team:
1. Automate repetition only where a machine can decide completion. Without a deterministic judge, a loop repeats a guess.
2. Separate what a machine checks from what a person must read, and compress the latter to what changed, why and where the risk is. Many workers still meet one pair of eyes.
3. Ask whether the work may be split, not whether it can. Two pieces that write the same target, one that reads what another writes, or a declared dependency are coupled: run them in order with one writer. Run in parallel only at zero coupling. Splitting adds no intelligence; it trades cost for success probability through division and verification.

Create an agent team only for a piece that needs one. When a team-design skill is installed, delegate the generation to it, then read the generated agents and skills, remove what the map does not need and verify one real run. Without one, write the smallest structure: role definitions as files, one orchestrating skill, the mode chosen by control flow (a script when order and stop conditions are enumerable, persistent named agents when the same specialist must keep context, one-shot delegation when only the result matters). Choose each role's model by its task, never one top model for all. Host workflow tools need the user's explicit opt-in; keep the default scale small.

Design the connections, not only the parts. Pass data by structured return or a named file. Name who learns of a failure and how. A missing result is recorded as missing; a stopped worker's judgment is never filled in by inference. An adversarial verifier or a judging panel belongs only where correctness matters and a machine can score it; no reviewer by default.

Put one piece into use before the next. Choose the piece with the clearest benefit, implement it on real input, verify it at the point of use with the delivery guide, then return to the map. Do not build the whole map at once, and retire a piece that goes unused.

Keep the map as one living note in existing knowledge (`work-context.md` suits it): current pieces, their state (existing, built, verified, planned), open unknowns and the next piece. Update it; do not create a design document per session. A map is context, not permission: a schedule, message, publication or deletion still needs the user's authority for that action.

Explain the design in the user's language: what their work looks like, what already exists, what you would build first and why, what it costs to run and maintain, and what remains unknown. Do not claim savings without a comparable baseline.
