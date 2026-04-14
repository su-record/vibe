---
slug: agents-md-stale-codex-paths
symptom: "AGENTS.md referenced .codex/vibe/ paths; coco's actual path is .coco/vibe/"
root-cause-tag: integration
fix-commit: pending
test-path: pending
status: open
registered: 2026-04-14
feature: vibe-test
---

# agents-md-stale-codex-paths

## Symptom

`AGENTS.md` (the coco instruction file) referenced `.codex/vibe/`, `.codex/settings.local.json`, and `~/.codex/{rules,...}` in its body. coco's real config dir is `~/.coco/` and project paths live under `.coco/vibe/`.

The stale state was not detected until the user pointed it out. A coco user following AGENTS.md verbatim would land on non-existent paths.

## Reproduction

**Given**: a vibe project that documents `.claude` ↔ `.coco` parity

**When**: read AGENTS.md and validate path references

**Then** (broken behavior): six occurrences of `.codex/vibe/`, `~/.codex/...` exist in the body

**Expected**: every path reference normalized to `.coco/` or `~/.coco/`

## Root cause

Commit `a2d53f1` (which removed Codex/Gemini install logic and added coco parity) removed the install code path but did not normalize the path references in AGENTS.md body. There is no automated check enforcing CLAUDE.md ↔ AGENTS.md sync, so drift accumulated silently.

Discovered while designing `/vibe.test`. This is exactly the bug class that the `path-error` category in `/vibe.test parity` is intended to catch.

## Fix

Replace every `.codex/` occurrence in AGENTS.md with `.coco/` (six locations).

Long-term fix: the `/vibe.test parity` subcommand validates path references automatically — every path cited in CLAUDE.md/AGENTS.md must resolve under the actual install dir.

## Related

- Fix commit: pending (committed alongside this regression record)
- Test path: no automated test yet — `/vibe.test parity` `path-error` category will guard regression once implemented
- Trigger: discovered while designing `/vibe.test` — the first dogfood case for this skill and the justification for its existence

## Notes

- `/vibe.test` itself was created to prevent this class of bug
- root-cause-tag `integration`: cross-harness sync was missed
- CLAUDE.md ↔ AGENTS.md drift is hard to catch via manual review — mechanical verification is required
