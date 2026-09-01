---
slug: agents-md-stale-codex-paths
symptom: "AGENTS.md referenced .codex/vibe/ paths; coco's actual path is .coco/vibe/"
root-cause-tag: integration
fix-commit: pending
test-path: npm run gen:agents-md:check
status: fixed
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

- Fix commit: pending (기록 직후 커밋 해시로 채운다)
- Test path: `npm run gen:agents-md:check` — CI `test` job 의 드리프트 가드 블록과 `verify:all` 에서 돈다
- Trigger: discovered while designing `/vibe.test` — the first dogfood case for this skill and the justification for its existence

## Closure (2026-09-02)

이 레코드가 지목한 **근본 원인**("CLAUDE.md ↔ AGENTS.md 동기화를 강제하는 자동 검사가 없다")이
`harness-discipline-import` SPEC 으로 닫혔다. `scripts/agents-md-rules.json` 이 번역 규칙의 SSOT 이고,
`scripts/gen-agents-md.ts` 가 CLAUDE.md 에서 AGENTS.md 를 결정론적으로 생성하며,
`npm run gen:agents-md:check` 가 드리프트를 CI 에서 막는다.

증상 문구의 `.coco/` 경로는 그 뒤 하네스가 Codex 로 되돌아가면서 **무효**가 됐다 — 이 레코드에서
살아있는 것은 경로 이름이 아니라 "게이트 없는 두 벌 문서는 조용히 갈라진다" 는 실패 유형이다.
게이트를 처음 돌렸을 때 실제로 드리프트 2건이 잡혔다 (`$vibe lint:ratchet` 과잉 번역,
Dual-Harness Doctrine 절 미번역) — 레코드가 예측한 그대로였다.

## Notes

- `/vibe.test` itself was created to prevent this class of bug
- root-cause-tag `integration`: cross-harness sync was missed
- CLAUDE.md ↔ AGENTS.md drift is hard to catch via manual review — mechanical verification is required
