# vibe 4 · 4.1.4 — the harness reads documents

## Why
A Claude Code session extracted a PDF with Python although its own reader handles PDFs, and Codex and Hermes have no document reader at all. The sample is the FDE's raw material; when the harness reads it, every client gets the same text and the model stops improvising. Excel, the format customers actually send, finally goes in as Excel.

## What counts as success
- `vibe read <file>` returns the text of xlsx (sheets as markdown tables), docx (paragraphs and tables in order), pptx (slides in order) and pdf (pdftotext when installed, a built-in reader otherwise), plus the table formats and plain text; it names the reader, supports `--sheet` and `--pages`, and truncates long output with a hint.
- `vibe profile` accepts xlsx, first or named sheet.
- The card gains rule 8: read files whole, search only to locate; documents and samples through `vibe read` / `vibe profile`; images through the client's own reader. The card stays under 1KB.
- The discover skill routes attachments by kind to profile, read, or the client's reader.
- Earlier gates still hold: build, tests, source ≤ 5,000 lines, six common skills ≤ 300 lines, plugin tree current.

## Constraints
- No dependency: zip via zlib, Office XML by pattern, PDF text operators by hand; quality is reported, never claimed.
- vibe does not read images and never pretends to.
- Every record is English; the model talks to the user in the user's language.
