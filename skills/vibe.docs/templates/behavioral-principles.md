<!-- VIBE-BEHAVIORAL:START -->
## Behavioral Principles (Karpathy-Inspired)

Derived from Andrej Karpathy's observations on LLM coding pitfalls.
Source: https://github.com/forrestchang/andrej-karpathy-skills

### Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask rather than guess.
- Present multiple interpretations — don't pick silently when ambiguity exists.
- Push back when a simpler approach exists.
- Stop when confused. Name what's unclear. Ask.

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't improve adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Remove orphans YOUR changes created — leave pre-existing dead code alone.
- Every changed line should trace to the user's request.

### Goal-Driven Execution

**Define success criteria. Loop until verified.**

| Instead of | Transform to |
|------------|--------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

Strong success criteria enable independent looping. Weak criteria ("make it work") require constant clarification.
<!-- VIBE-BEHAVIORAL:END -->
