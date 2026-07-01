---
name: restraint
user-invocable: false
invocation: [auto]
tier: core
description: "Restraint gate — block premature abstraction and premature optimization. Escalate the YAGNI ladder only on demonstrated need; optimize only on measured evidence. Merges yagni-ladder + rob-pike."
triggers: [premature optimization, premature abstraction, abstraction layer, helper module, utility class, wrapper class, manager class, config system, cache layer, parallelize, benchmark]
priority: 60
---

# Restraint — Don't Write It, Don't Tune It (Yet)

Two constraints, one gate:

- **No premature code.** New abstractions must be *pulled* by a demonstrated
  need, never pushed by "might need it later." Once the code exists, deleting
  it costs more than never writing it.
- **No premature optimization.** Performance work must be *pulled* by a
  measurement, never by a hunch.

## The YAGNI Ladder (code axis)

Satisfy the need at the **highest** rung that covers it; lower rungs are
blocked while a higher one applies:

1. **Not needed** — the requirement doesn't ask for it → don't build it
2. **Stdlib / built-ins** already do it (`crypto`, `Intl`, `pathlib`, …)
3. **Native platform feature** does it (`<input type="date">`, CSS `:has()`, DB constraints)
4. **Already-installed dependency** covers it — check the lockfile, don't guess
5. **One line** — a single expression; no new file, no class
6. **Minimal code** — only now, and nothing for "later"

Tie-break: native beats a one-liner; stdlib beats a dependency. Generalize
only when a *second* caller exists.

## Pike's Rules (optimization axis)

- You can't tell where a program spends its time — bottlenecks surprise.
  **Measure; don't guess.**
- Don't tune until one part *measurably* overwhelms the rest.
- Fancy algorithms are slow when n is small — and n is usually small.
  Ask "what's n?" before "what's the Big-O?"
- Simple algorithms + the right data structures beat clever code. Data dominates.

Optimization is justified only when ALL hold: a measured bottleneck exists →
it dominates runtime → the fix is the simplest change addressing it → you
re-measure after.

## Blocked Impulses

| Impulse | Constraint | Counter |
|---|---|---|
| helper / utility / wrapper / manager class | rungs 1–5 | a stdlib call or one line usually suffices |
| config system for one value | rung 1 | a `const` is the config |
| generic `Processor(strategy, validator…)` | rung 1 | one concrete function until a second caller exists |
| "add a cache here" / "parallelize this" | measure first | is this path even hot? Often it's I/O |
| swap in a B-tree / trie / skip list | what's n? | O(n²) with n=100 is microseconds |
| "this loop looks slow" | measure first | the bottleneck is probably elsewhere |

## Overrides — Restraint Never Erodes These

1. **Security and trust-boundary work are requirements**, not optional
   complexity. Input validation, auth checks, escaping stay in — "one line"
   is no excuse to drop them.
2. **Deliberate simplifications get a comment + upgrade path**, so the next
   reader sees a *choice*, not an oversight:

   ```ts
   // Global lock is enough at current throughput.
   // Switch to per-account locking if write contention shows up.
   const lock = new Mutex();
   ```
