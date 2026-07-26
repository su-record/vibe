---
name: vibe.continue
description: 세션을 넘기거나 이전 작업을 계속해야 할 때 — reset 전 HANDOFF.md를 만들거나 최신 handoff/checkpoint에서 상태를 복원한다.
argument-hint: "[handoff]"
user-invocable: true
---

# /vibe.continue

## Done Criteria

- [ ] handoff mode에서는 HANDOFF.md가 지정 경로에 존재한다.
- [ ] restore mode에서는 복원한 checkpoint 또는 handoff 경로가 보고된다.
- [ ] 현재 목표, 변경 파일, 검증 상태, 다음 작업이 결과에 포함된다.

Restore previous session context for continuity.

## Usage

```
/vibe.continue
/vibe.continue handoff
```

## Process

- **Restore mode** (default): locate the newest project checkpoint,
  `HANDOFF.md`, and `.vibe/memories/` record; read them in full, reconstruct
  completed work and the next step, verify against `git status`, then resume.
- **Handoff mode**: read `references/handoff.md`, generate `HANDOFF.md`, read it
  back, and verify its tasks, decisions, changed files, branch, and test status
  against repository state.

## When to Use

- At new session start, to pick up exactly where the previous session left off
- At 85%+ context usage: persist a checkpoint/handoff → start a fresh session using the harness's session reset → `/vibe.continue`
- Invoke the `vibe.handoff` compatibility name when an existing workflow expects it; it delegates to handoff mode.

---

ARGUMENTS: $ARGUMENTS
