# vibe 4 · 4.1.10 — the harness reads for the model: `vibe read --ask` hands a file corpus to a low-reasoning model

## Why
Most of a coding session's tokens go to reading, not reasoning: the frontier model loads whole files into its context to answer "what does this module do", "where is X handled", "what does this report say". Spotify's shunt plugin measured a ~90% mean token cut on bulk reads by routing them to a cheap worker model whose reply — not the files — enters the main context. Its limits are documented: the worker's summaries carry no line numbers, so edits and debugging still need the real file.

vibe already has the two pieces: `vibe read` extracts text from any document with no dependency, and the `review` check already spawns the client CLI (`claude -p`, `codex exec`) with a prompt on stdin. Joining them gives every client the same delegation without a hook that blocks reads: the harness reads, numbers the lines, asks a low-reasoning model, and returns only the answer. Card rule 8 ("read files whole") stays for editing and debugging; the new rule says when not to.

## What counts as success
- `vibe read <file…> --ask "<question>"` extracts every named file (documents through the existing readers, code and text verbatim), numbers the lines of text and code files (`N| line`) so the answer can cite them, wraps each file in `<file path="…">…</file>`, puts the question last, and sends the bundle on stdin to the reader command. The reply is the command's stdout; stderr reports `files · chars in · reader · chars out · ms`; `--json` carries `{ files, chars, reader, reply, ms }`.
- `vibe read <file…>` without `--ask` accepts several files and prints them one after another, as before for one.
- The reader command is `VIBE_READER_CMD` when set, else `reader` in `.vibe/config.json`, else `claude -p --output-format text --model haiku` when `claude` is on PATH, else `codex exec -c model_reasoning_effort=low -` when `codex` is; with none the command fails with exit 2 and names the three options. `CLAUDECODE` is removed from the child environment as in the `review` check.
- The bundle is capped at 400,000 characters; over the cap the command fails with exit 2 and tells the caller to ask about fewer files or use `--pages` / `--sheet`. The reader has 300 s.
- The notification hook gains a `PreToolUse` entry for `Read`: inside a vibe project, when the file being read is over 400 lines, it adds context naming the line count and `vibe read <file> --ask "…"`. It never blocks; outside a project it is silent; both plugin manifests (`hooks/hooks.json`, `hooks/codex-hooks.json`) and the home-settings install carry the entry.
- Card rule 8 says when to delegate: a file that only has to be understood, not edited or debugged, goes through `vibe read --ask`. The card stays ≤ 1KB. `vibe-build` and `vibe-discover` name the same rule in one line each; the six common skills stay ≤ 300 lines.
- Tests: a fake reader (`VIBE_READER_CMD`) proves the bundle shape (file tags, numbered lines, question last, several files), the reply passthrough, the cap, and the exit-2 error without a reader; the hook test proves the advice for a long file and silence for a short one.
- Live proof: with `claude` on this machine, `vibe read src/core/lang.ts --ask "…"` through Haiku names `detectLang`.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, six common skills ≤ 300 lines, language packs within budget, plugin tree current for 4.1.10, README status line carries `4.1.10`, help lists `--ask`.

## Constraints
- No new dependency. The worker is whichever client CLI is already installed; nothing is downloaded.
- The hook advises; it never blocks a read. Card rule 8 (read whole for editing and debugging) is not weakened.
- `review` check behaviour does not change.
- Every record is English; the model talks to the user in the user's language.
