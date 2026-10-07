# Code

Use existing conventions and the simplest implementation that handles actual inputs. Read nearby code before editing. Prefer meaningful names, explicit error causes and tests of observable behavior. Remove unnecessary wrappers only within the task; do not redesign unrelated code.

Apply these antislop criteria while writing and revising the affected code, without waiting for a separate request:

- Prefer behavior and repository fit over brevity. Preserve public contracts, error handling, security boundaries and useful resource limits.
- Justify abstractions, configuration and dependencies with actual requirements or existing conventions. Avoid forwarding wrappers, speculative extensibility and duplicate helpers that add no useful boundary.
- Name the operation or domain concept. Comments explain reasons and constraints rather than restating the code; errors identify the failed operation without leaking secrets.
- Remove introduced dead code, placeholder implementations and swallowed errors. Preserve intentional recovery and established compatibility layers.
- Test observable outcomes when tests are warranted. Do not add tests solely to mirror internal calls or prove cosmetic edits.

Patterns are evidence to examine, not banned syntax: a single-implementation interface, defensive check or TODO can be justified. Fix a specific behavior or maintenance problem, not an aesthetic preference. Do not read the full legacy skill or run its editorial chain as an automatic follow-up.

Run relevant existing tests and required integration checks. Do not start a reviewer merely to apply this guidance. A requested review targets the change and its contracts, without imposing generic style preferences.
