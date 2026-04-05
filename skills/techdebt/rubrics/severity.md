# Techdebt Severity Rubric

## P1 — Blocks Merge

Issues that introduce bugs, security holes, or break type safety. Must fix before merging.

| Pattern | Why P1 |
|---------|--------|
| `: any` / `as any` | Breaks TypeScript safety guarantee |
| `@ts-ignore` | Hides real type errors |
| `debugger` statement | Halts execution in production |
| Hardcoded secrets / credentials | Security risk |
| Circular imports causing runtime errors | Breaks module loading |

**Rule**: P1 count must be 0 before merge.

## P2 — Fix Before PR

Issues that reduce maintainability, performance, or correctness. Should be resolved before PR review.

| Pattern | Why P2 |
|---------|--------|
| `console.log` / `console.warn` | Debug noise in production logs |
| Functions > 50 lines | Violates complexity limit; hard to test |
| Nesting depth > 4 | Cognitive overload; obscures logic |
| Unused imports | Bundle bloat; misleading code |
| TODO/FIXME without ticket | Ambiguous ownership |
| Duplicate logic (2+ files) | Maintenance hazard |

**Rule**: P2 items are warnings. Resolve or create a tracked P3 ticket before merge.

## P3 — Backlog

Issues that are cosmetic or nice-to-have. Address during scheduled cleanup sessions.

| Pattern | Why P3 |
|---------|--------|
| Magic numbers (non-critical) | Readability |
| Commented-out code | Noise |
| Inconsistent naming | Style drift |
| Missing JSDoc on internal helpers | Documentation gap |
| Slightly long files (200–499 lines) | Future extraction candidate |

**Rule**: P3 items never block. Review weekly; archive when resolved.

## Convergence Rule

- Round 1: address all P1 + P2
- Round 2: address remaining P1 + P2 only
- Round 3+: P1 only
- Same findings as previous round → stop immediately
