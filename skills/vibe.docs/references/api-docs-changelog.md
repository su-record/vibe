# docs — API Docs & Changelog Spec

> Loaded by docs SKILL.md for `/vibe.docs release` (changelog mode) and API-heavy projects (api-docs mode) — documentation rules for the two artifacts that go stale fastest: API docs and changelogs.

## API Mode

Walk the route handlers/controllers in the given scope and document each
endpoint: method + path, auth requirement, parameters (path/query/body with
types, required vs optional, enum values), success and error responses (all
status codes actually returned), and a runnable example (curl or fetch). List
endpoints that exist in code but lack documentation — the gap list is as
valuable as the docs.

## Changelog Mode

From `git diff` and `git log`, classify changes as breaking / added /
changed / fixed / performance / internal / dependencies. Recommend the
semantic version bump with a one-line reason. Every breaking change gets
migration steps; every fix states old vs new behavior.

## Constraints

Return documentation as text output only — never create or write files; the
calling command decides where content lands. Descriptions are user-facing:
what changed for the consumer, not which internal function was refactored
(pure refactors go under Internal, briefly). Document what the code actually
does, not what comments claim — when they disagree, flag the discrepancy
rather than picking one silently.

## Done

- API mode: every endpoint in scope documented or explicitly listed as an undocumented gap
- Changelog mode: all changes classified, version bump recommended with reason, breaking changes have migration steps
- Output is paste-ready text; zero files created
