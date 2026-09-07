# vibe 4 · 4.1.12 — the agent's own report is not slop: card rule 9 and the handoff voice

## Why
The antislop packs clean what the model ships. Nothing yet governs how the model talks about the work while it happens: "I've fixed the auth bug and everything should work now", an apology before an error, a closing offer, a runtime quoted in human days. slopgent (ehmo/slopkit) names this as a separate problem and orders its fixes honesty first, then structure, then plain language; its measured edge over "be concise" skills is that it keeps the one caveat that changes the user's next decision while cutting every other hedge. vibe already holds the honesty gate itself — rule 2, nothing is done until `vibe check` says DONE — so what is missing is the shape of the report: what changed kept apart from what was verified, the load-bearing caveat kept, action first, no theatre.

## What counts as success
- Card rule 9, within the 1KB card: report what changed apart from what `vibe check` verified; keep the caveat that changes the user's next step and cut every other hedge; an error is its cause and its fix; the action or answer leads; no praise of the request, no apology, no closing offer. Rule 8 is shortened to make room; rules 1–7 do not change in meaning.
- `vibe-handoff` gains a `## Report voice` section that the completion report and the handoff document follow: each "Built" line says what changed and names the check and run that verified it, or says "not checked"; "successfully", "should work" and "everything is in place" never appear — the verdict is `vibe check`'s line; the caveat that changes the operator's next decision (scope, risk, what was left out) stays, other hedges go; errors read cause then fix; an estimate of remaining work is given in turns and tool calls with the one variable that widens it, never in human calendar time; the handoff document is human-read English, so `antislop-en` applies to it and a `review` scenario on it is proposed (`⚠ model-judged`) when the intent has room.
- The six common skills stay ≤ 300 lines in total; the card stays ≤ 1024 bytes.
- `checks/report-voice.js` proves the card carries rule 9 (the words "changed", "verified", "caveat" in one rule) and that the handoff skill has the `## Report voice` heading with the "not checked" and "turns" rules.
- Earlier gates still hold: build, tests, file 400 / function 50, skill names, packs, plugin tree current for 4.1.12, README status line carries `4.1.12`.

## Constraints
- No new command and no new check type; this is card and skill text only, plus the gate that proves it is there.
- The card keeps rule 2 as the honesty gate; rule 9 is its voice, not a second gate.
- Every record is English; the model talks to the user in the user's language.
