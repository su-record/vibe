---
summary: "What the user wants from vibe (one public entry, a personal FDE, beginner-level explanations) and the open Windows Codex hook report after 4.2.2."
type: decision
tags: [goals, decisions, windows, codex]
aliases: [work context, project goals, 업무 맥락, 목적과 결정]
updated: 2026-10-16
---
# Vibe work context

Source: the user's conversations in this project and the 4.2.2 release record. Written 2026-09-14, translated to English 2026-10-16. Scope: the vibe project; do not widen it into general user preferences.

## Confirmed goals and decisions

- The user wants a personal FDE in the Claude and Codex desktop apps that understands and solves their work. Keep npm distribution and the single public entry `vibe`.
- Look for existing skills not only when a capability is missing but when better accuracy, speed or less repeated work is expected. Check installed capabilities and earlier research first and read only the guidance needed.
- Cut needless branches, token exchanges, default model reviews and repeated verification, but keep the risk and recovery checks complex work requires.
- The user asked for outcomes, reasons, how things work and limits explained so a beginner understands. Do not answer with a list of jargon or shorten an explanation by default.
- Keep the read feature. Read short files and code to be edited directly; consider the reading model only for a narrow question about long material when the extra cost is justified.

## Environment and open observations

- The user reported what looked like Codex hook errors on a Windows PC. The exact hook command and the PC's logs were not obtained.
- 4.2.2 fixed hook replacement and duplication on Windows paths. It passed 396 local tests and Linux and Windows CI and was published as npm latest: https://github.com/su-record/vibe/releases/tag/v4.2.2
- Not yet confirmed: whether the error disappeared in real chats on that PC after updating. CI passing is not evidence for this observation. Continue when the user reports again or new evidence is available.

## How this changes current work

- Keep apart tests passing, behaviour in the target environment and the user's acceptance.
- Apply a correction to the current work first, then update this record while keeping earlier decisions that still hold.
- For a repeated workaround, find the common cause and reuse existing skills and tools first. Do not start an unrequested platform rewrite just because something could be reused.

This record is context; it grants no extra permission for external actions and no new completion verdict.

## Related

- [[projects/vibe/development]] — how to develop and verify vibe in this repository
