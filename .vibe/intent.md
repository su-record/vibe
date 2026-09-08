# vibe 4 · 4.1.19 — vibe runs on Windows

## Why
On Windows every `vibe` command exits without a line of output. The entry guard at the end of `dist/cli.js` decides whether `main()` runs by comparing `process.argv[1]` with the file's own path, and it takes that path from `new URL(import.meta.url).pathname` — on Windows that is `/C:/Users/…/cli.js`, which never equals the real path, so `main()` is never called. The guard has read the URL this way since 4.0.1; today was the first real run on Windows. A second Windows defect sits behind it: the reader and reviewer drivers spawn the client CLI through the shell there (a `.cmd` shim needs one), and Node joins the arguments with spaces without quoting, so an empty argument such as `--tools ""` vanishes and `--tools` swallows the next flag.

## What counts as success
- The entry guard compares real paths obtained with `fileURLToPath(import.meta.url)`, so a global install through npm's `.cmd` shim, a bin symlink, and a direct `node dist/cli.js` all run `main()`; a path with a percent-encoded space is handled.
- Whenever a client CLI is spawned through the shell on Windows (the reader and reviewer drivers, the `--version` probe, the hook's fallback), every argument that is empty or holds a space, a quote or a shell metacharacter is quoted for `cmd.exe`, so it arrives as one argument and an empty one arrives empty.
- Tests: the guard's comparison is a pure function tested with a `file:` URL holding a percent-encoded space against the decoded path and against a symlink to it; the Windows quoting is a pure function tested on an empty argument, a spaced one, one holding a double quote, and a plain one (unchanged).
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, no catalogue, plugin tree current for 4.1.19, README status line carries `4.1.19`.

## Constraints
- No Windows machine is available to this session; the fix is by construction and by the two pure-function tests, and the user verifies on Windows after the release.
- Every record is English; the model talks to the user in the user's language.
