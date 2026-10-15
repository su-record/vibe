# Larger problems (4.2.13)

## Why

The effect of an agent grows with the size, difficulty and horizon of the problem it is given, peaks where results are digital and machine-checkable, and depends on the access tier in use. vibe's guidance until 4.2.12 only narrowed scope (do the request, add no ceremony); nothing helped a user move from one-off questions to the larger problem behind them.

## What changed

- `internal/guides/ambition.md`: offer the larger problem once and only on observed evidence; keep a `problems.md` note; make each part checkable before making it large and say at the start which parts need the user's eyes; run long outcomes as milestones; report an observed model or tool constraint once and never change access on its own.
- `problems.md` joins the priority notes the brief reads first (after `corrections.md`, `work-context.md`, `reuse.md`).
- The entry skill names the guide in its existing discover line.

## Verified

The guide is served by name, its boundary sentences are asserted, the note priority order is tested, and `checks/mutation.js` mutates the priority list and its ordering.

## Not verified

Whether a model that loads the guide actually offers the larger problem once, declines to invent one, or produces better outcomes. That needs a model-scored evaluation and is left for the next bench run.
