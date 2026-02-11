# P2 - Redundant IterationTracker + ProgressTracker

## Category: Architecture / Simplicity

## Files
- `src/lib/IterationTracker.ts` (~252 lines)
- `src/lib/ProgressTracker.ts` (~333 lines)

## Description
Both track nearly identical concepts (phase status, progress, timestamps) with different persistence strategies. IterationTracker uses global mutable state, ProgressTracker uses file-based JSON. Combined ~585 lines.

## Fix
Merge into single module. Pick file-based persistence (more robust). Remove global mutable state pattern and `detectSplitSpec` stub.

## Requires
Design decision + consumer migration
