# vibe 4 · 4.1.5 — Hangul files and HTML

## Why
Korean customers and public bodies send .hwp and .hwpx. Neither Claude Code nor Codex reads them, and no machine has a converter by default. The harness reads both in-house — HWP 5 through its OLE container and zlib records, HWPX through OWPML — and HTML as content, so every client sees the same text.

## What counts as success
- `vibe read` returns the paragraphs of an HWP 5 file in order across sections, skipping control characters, and refuses a password-protected file with a clear reason; HWPX paragraphs come out in section order.
- HTML is returned as content: scripts and styles gone, blocks on their own lines, table cells joined.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- No dependency: an OLE reader, record parser and OWPML pattern reader in-house; the test builds its own OLE fixture.
- Every record is English; the model talks to the user in the user's language.
