---
name: yagni-ladder
user-invocable: false
invocation: [auto]
tier: core
description: "YAGNI Ladder — block writing code before checking 5 cheaper rungs. Sibling of rob-pike: rob-pike blocks premature optimization, this blocks premature code. Auto-activates when about to write non-trivial implementation code."
triggers: [add feature, implement, create a class, write a, build a, helper, utility, wrapper, abstraction, manager, handler, service for]
priority: 90
---

# The YAGNI Ladder

`rob-pike` blocks premature *optimization*. This blocks premature *code*.

The agent's default failure mode is writing too much: a 50-line class for a
one-line job, a wrapper around something the stdlib already does, a config
system for a value that never changes. Catch it **before** generation, not in
review — once the code exists, deleting it costs more tokens than never writing
it.

## The Ladder

Before writing implementation code, climb these rungs **in order** and stop at
the **first** one that satisfies the need:

1. **Is it needed at all?** — Does the requirement actually ask for this, or am
   I inventing it? If speculative ("might need it later"), stop. Don't build it.
2. **Is it in the stdlib?** — Language standard library / built-ins. (`crypto`,
   `Intl`, `Array.prototype`, `pathlib`, …)
3. **Is it a native platform feature?** — The runtime/platform already does it.
   (`<input type="date">`, CSS `:has()`, HTTP caching headers, DB constraints.)
4. **Does an already-installed dependency do it?** — Check `package.json` /
   lockfile first. Don't add a dependency for what an existing one covers.
5. **Can it be one line?** — A single expression / call, no new file, no class.
6. **Only now: write the minimal code** — and no more than rungs 1–5 left undone.

**Tie-break rule:** if two rungs both apply, take the **higher** rung (lower
number). Native feature beats a one-liner; stdlib beats a dependency.

## Anti-Patterns to Block

| Impulse | Rung that catches it | Response |
|---|---|---|
| "I'll write a date-picker component" | 3 (native) | `<input type="date">`. One line. |
| "Add a `StringUtils.isEmpty()` helper" | 2 (stdlib) | `!s` / `not s`. The language already does this. |
| "Let me build a retry wrapper class" | 4 (installed dep) | Does an HTTP/util lib in the lockfile already retry? |
| "I'll add a config system for this value" | 1 (needed?) | It's one constant that never changes. A `const` is the config. |
| "A `CacheManager` class with TTL + eviction" | 1 / 5 | Is concurrency real yet? A `Map` + one `setTimeout` may be the whole job. |
| "Generic `DataProcessor(strategy, validator…)`" | 1 (needed?) | One concrete function. Generalize when a *second* caller exists. |
| "190-line animated dashboard" | 1 (needed?) | Did the task ask for animation, or just the number? Ship the 13 lines. |

## When Writing The Code IS Justified

Proceed to rung 6 only when ALL are true:

- Rungs 1–5 genuinely don't cover it (you checked the lockfile, not guessed).
- The requirement explicitly asks for it — not "might need."
- You write the **minimum** that satisfies the requirement, nothing for "later."

## Two Hard Rules That Override Simplicity

Simplification pressure must never erode these:

1. **Never skip security or trust-boundary work.** Input validation, auth
   checks, escaping, permission boundaries — these are *requirements*, not
   optional complexity. "One line" is no excuse to drop a validation.
2. **Leave a comment + upgrade path on deliberate simplifications.** When you
   pick the simple option knowing a bigger one might be needed later, say so in
   the code so the next reader sees it was a *choice*, not an oversight:

   ```ts
   // Global lock is enough at current throughput.
   // Switch to per-account locking if write contention shows up.
   const lock = new Mutex();
   ```

## Relationship to Other Skills

- **`rob-pike`** — same shape, optimization axis. Climb both ladders: don't
  optimize without measuring, don't write code without climbing the rungs.
- **`simplicity-reviewer`** (review agent) — the *sufficiency net* after the
  fact. This skill is the *generation gate* before the fact. If this skill did
  its job, simplicity-reviewer finds nothing to delete.

## Questions to Ask Before Writing

1. "Does the stdlib or platform already do this?"
2. "Is there a dependency already installed that covers it?"
3. "Can this be one line instead of one file?"
4. "Am I building for a requirement that exists, or one I imagined?"
