# vibe 4 · 4.1.24 — asking is a stop, a failure names its files, a claim is audited, and Codex's trust is visible

## Why
4.1.23's fair bench passed its gate, and its transcripts left one number to chase and two habits to remove. On `ask`, Codex with vibe spent 49.8 turns against bare Codex's 16.2 for the same right answer. The transcripts say why, and none of it is Codex's fault alone:
- After `vibe ask`, the `next` line said `answer inbox [q-…] — then continue`, which the model read as an instruction to itself: in the second session Codex answered its own two questions with the text from TASK.md and resolved them — four wasted calls — and in the first session it kept working after asking instead of stopping.
- "On a failure, `vibe context <id>`" was applied to every failing check, every time: `vibe context total` and `vibe context lines` 3.4 times each per run, though the failure was a missing answer, not a missing file.
- The bench never had Codex's hooks trusted before 21:00 KST 2026-09-09, and a real install has the same gap: Codex records a `trusted_hash` per hook in config.toml and vibe cannot write it (the format is not public), so a user who installs vibe on Codex has no gate, no hand-over and no stop verdict until Codex asks them once — and nothing tells them.
Two ideas from Pstack (Lauren Tan) are cheap and fit: a probe before scenarios, and an audit of the model's own completion claim against the verdict.

## What counts as success

### A · Asking is a stop
- `vibe ask` says so: its text ends with `stop here and wait — the user answers in chat (or vibe inbox answer <id> "…" as the user); do not answer it yourself`, and its JSON carries `wait: true`.
- The `next` line distinguishes the three inbox states: a question asked and unanswered → `wait — q-… asked; the user answers; stop`; answered but not resolved → `answered q-…: "<answer>" — continue building; vibe inbox resolve q-… once used`; none open → the stage's own line. `vibe state` lists an answered question with its answer.
- The STUCK line follows the same rule: `STUCK — q-… asked; the user answers; stop` until the answer is in, then `answered … — vibe check --all`.

### B · A failure names its files; context is for what files do not say
- A failed check's line in `vibe check` output carries `files: …` (the scenario's files, as `vibe state` names them) and the `next` line after a failure says `fix <id> — files: …; vibe context <id> only for decisions and notes`.
- The procedure's failure phrase becomes `on a failure, fix what the check names; vibe context <id> when that is not enough`, in one source, quoted by card rule 2, the router, the build skill and README (`checks/procedure.js`).

### C · A claim is audited at the stop
- The Stop hook reads the transcript's last assistant message (`transcript_path` in the payload, Claude Code and Codex alike) and, when it claims completion — done, complete, finished, passed, ready, all checks — while the state is not DONE, blocks with `unverified: "<claim>" — vibe check says <state>, <remaining> remaining`. A DONE state or a message with no claim passes; a turn already continued by this hook is let go.
- Card rule 9 keeps "unchecked is unverified"; the hook makes it structural.

### D · Codex's hook trust is visible
- `vibe status` and `vibe setup` read `~/.codex/config.toml` `[hooks.state]` and say, per hook source vibe installed (the plugin's `codex-hooks.json`, or the settings `hooks.json`), whether Codex trusts it; when not, the line says: `open Codex once in a vibe project and accept its hooks, or pass --dangerously-bypass-hook-trust in automation`. Tests with a fake config.toml.

### E · Probe and check-first, in the scope skill
- Before scenarios are written, an assumption about the environment or an API that the intent rests on is probed with a one-file script whose result goes into the intent's Why; a scenario that has no deterministic check gets its check script written under `checks/` first, before the code the scenario is about.

### F · The bench, once more
- Every set reruns on both clients; the gate passes; `bench/claims/2026-09-09-4.1.24.md` pre-registers the same rules plus one: Codex's turns on `ask` at most 2× bare Codex's. README's opening is rewritten only where a number moved.
- Found on the way: the fake user answered only questions with a question mark, and bare Claude Code asks in statements ("give me the rate and discount"); answered fairly, both bare models get `ask` right — nothing to prevent, `ask` is retired under the pre-registered rule, and README withdraws the five-of-five claim.

## Constraints
- Patch version 4.1.24; files ≤ 400 lines, functions ≤ 50; card ≤ 1024 bytes; six skills ≤ 300 lines.
- No release until the gate passes on both clients and the check is DONE.
