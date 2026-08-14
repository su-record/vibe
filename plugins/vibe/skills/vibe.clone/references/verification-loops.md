# Clone — Phase 4 Compile Gate & Phase 5 Pixel Verification

> Loaded by vibe.clone SKILL.md Phases 4–5. Both loops follow `vibe/rules/loop-contract.md`
> (ANCHOR→ACT→JUDGE→RECORD); exit = gates pass │ stuck │ max-iter.

## Phase 4: Compile Gate

```
No round cap. Loop until compile succeeds (or stuck → end loop; automationLevel decides
whether the user is asked — see Termination below).

0. Capture baseline (before Phase 3): record existing tsc + build errors
   → Phase 4 only fixes NEW errors

1. TypeScript: vue-tsc / svelte-check / tsc --noEmit
2. Build: npm run build (120s timeout)
3. Dev server: npm run dev → detect port → polling

On error: parse → auto-fix → re-check
Termination:
  ✅ Success: all checks pass → enter Phase 5
  ⚠️ Stuck: same errors as previous round → ask user
     1. Direct fix instructions → retry
     2. "proceed" — record remaining errors as TODO, proceed to Phase 5
     3. "abort" — halt
  automationLevel: autonomous → on stuck, record TODO without prompting and proceed

⛔ Must enter Phase 5 after Phase 4 passes. Do NOT output a "completion summary".
```

## Phase 5: Pixel Verification Loop — MANDATORY

**⛔ Phase 5 is mandatory, not optional. Enter automatically after Phase 4.**
**⛔ Skipping Phase 5 makes the entire clone "incomplete".**

```
No round cap. Loop until P1=0 (or stuck → end loop; automationLevel decides whether the
user is asked — see Termination below).
Infrastructure: src/infra/lib/browser/ (Puppeteer + CDP) — same as figma Phase 6.

1. Render scaffolded page in dev server at matching viewport
2. Capture screenshot → pixelmatch comparison against /tmp/{feature}/{bp}/screenshot.png
   diffRatio > 0.05 (clone target is tighter than figma) → P1
3. CSS comparison: live computed CSS vs /tmp/{feature}/{bp}/computed.json
   delta > 2px → P1, ≤ 2px → P2
4. Asset audit: every <img>/background-image resolves to local public/images/ path → else P1
5. Fix P1 first (refer to computed.json, no guessing) → revalidate compile → reload

Narrowing scope:
  Round 1: P1+P2+P3
  Round 2: P1+P2
  Round 3+: P1 only

Termination:
  ✅ P1=0 AND no new findings → complete
  ⚠️ Stuck: same findings → ask user (resolve / proceed / abort)
  automationLevel: autonomous → on stuck, record TODO without prompting and end the loop
     as `stuck` — never record unresolved P1 as complete (SSOT: vibe/rules/loop-contract.md)

Responsive: after MO verification → change viewport → repeat against PC screenshot
Post-merge (Phase 3C): re-run at BOTH viewports (375×812 vs mo/screenshot.png,
  1440×900 vs pc/screenshot.png) — either failing means the merge regressed; fix the
  merged SCSS (evidence: the per-BP sections.json), never by re-guessing values
Cleanup: shut down browser + dev server

⛔ "Completion summary" output only allowed after Phase 5 completes.
```
