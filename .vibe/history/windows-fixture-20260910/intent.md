# Preserve the missing-shell fixture on Windows

## Why
The first Windows CI repair leaves one failure: a differently cased inherited COMSPEC overrides the missing ComSpec injected by the startup-failure test. The user chose portable fixes; Claude accepted removing the inherited key instead of weakening the assertion.

## Success
- The Windows fixture removes all case variants before setting a nonexistent shell executable.
- Existing startup-failure, exit-7 and exit-0 assertions remain and pass; the complete build and suite pass.
- An independent reviewer and maintainer accept the fixture correction.
- The benchmark ledger remains unchanged. Claude reruns Windows CI on the delivered commits; no live benchmark is rerun.

## Prior completed work
2ef5a0f passed local 12/12 including all six real load child exits, and fixed nine of ten Windows failures. The subsequent native-path commit passed local 10/10 including 268 tests and three reproduced path regressions. Those immutable reports remain in check-all.json and check-paths.json. This follow-up edits only the test environment for the one remaining Windows failure.
