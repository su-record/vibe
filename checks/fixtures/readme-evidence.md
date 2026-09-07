# Evidence for README's reader measurement (4.1.10)

Measured on 2026-09-06 with Haiku through `vibe read --ask`:
- reader context with its own system prompt and no settings: 428 tokens
- a bare `claude -p` inside the project: 16,311 tokens (README rounds to 16,000)
- bundle: 37,576 characters
- first ask: $0.044, 9.8 s (13,132 tokens written to cache)
- follow-up in the same session: $0.0053, 5.3 s (13,132 tokens read from cache)
- the session index keeps an entry for one hour
- README's line-numbering example reads `12| …`
- the notification hook advises `--ask` on a file over 400 lines (the repository's own file limit)
