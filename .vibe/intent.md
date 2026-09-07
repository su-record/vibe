# vibe 4 · 4.1.15 — `vibe size` reads regex literals

## Why
`vibe size` counts a function by its braces, skipping strings, template literals and comments. It does not know a regular-expression literal, so a quote or a backtick inside one — `/matches "([^"]*)"/`, `` /`([a-z]+)`/ `` — opens a string that never closes, every brace after it is ignored, and the function runs to the end of the file. It reported `bodyTerms()` at 117 lines and `search()` at 72 in 4.1.14 (both under 30), and the 4.1.8 triple-quote case was the same class. Both were worked around by rewriting the code; the parser should read the code as written.

## What counts as success
- The brace lexer recognises a regex literal: a `/` where an expression can start — at the start of a line, or after `( , = : [ ! & | ? { } ; + - * % < > ~ ^` or the keywords `return`, `typeof`, `case`, `do`, `else`, `in`, `of` — and skips to its closing `/`, honouring escapes and character classes, then its flags; a `/` after an identifier, a number, `)` or `]` is division and is not skipped.
- Quotes, backticks and braces inside a regex literal do not change the lexer state; a regex never spans lines.
- Unit test: a function holding `/matches "([^"]*)"/`, `` /`([a-z]+)`/g ``, `/[`"'{]/`, a division `a / b / c`, and a template literal holding three double quotes measures at its true length, and a function after it measures at its own.
- The worked-around code in `src/core/research.ts` returns to plain regex literals and `vibe size` still reports every file and function within limits; the regression is recorded.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, plugin tree current for 4.1.15, README status line carries `4.1.15`.

## Constraints
- No new dependency; the lexer stays a line-by-line state machine.
- Every record is English; the model talks to the user in the user's language.
