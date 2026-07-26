---
slug: pre-tool-guard-content-false-positive
symptom: "Write/Edit blocked even when file_path is safe, because content contained literals like '/etc/' or '.env'"
root-cause-tag: validation
fix-commit: ff9aafb
test-path: hooks/scripts/__tests__/pre-tool-guard.test.js
status: test-generated
registered: 2026-04-14
feature: pre-tool-guard
---

# pre-tool-guard-content-false-positive

## Symptom

`Write` or `Edit` to a safe path (e.g. `src/machine-key.ts`) was being blocked at critical severity (exit 2) or warned at medium severity, when the file body contained string literals such as `/etc/machine-id`, `/usr/sbin/ioreg`, `.env`, `secret`.

Real report: writing a `machine-key.ts` whose source code mentions `/etc/machine-id` was blocked with `Writing to system directory`. The user worked around it by splitting the path: `['', 'etc', 'machine-id'].join('/')`.

## Reproduction

**Given**: a safe path like `src/machine-key.ts`

**When**: `Write` is called with content containing the literal string `'/etc/machine-id'`

**Then** (broken behavior): exit code 2, output `🚫 BLOCKED: Writing to system directory`

**Expected**: exit code 0, no warning (file_path is safe)

## Root cause

`pre-tool-guard.js`'s `validateCommand` ran the regex against the entire `JSON.stringify`d `tool_input`. The intent of the write/edit patterns (`/\/etc\//`, `/\.env/`, etc.) was to inspect the **target path**, but matching against the combined string made any literal in the content trigger a false positive.

Existing tests all used argv mode (`runGuard`) and passed only `file_path` as a single string, so this case was never exercised. The test file even had a comment `// tool_input is stringified — pattern matches against the JSON string` which acknowledged the behavior — but it was a bug, not the intent.

## Fix

Added a `target` field (`'command' | 'file_path' | 'raw'`) to each `DANGEROUS_PATTERNS` entry. `validateCommand` now extracts only the targeted field via `extractTarget(rawInput, target)` before matching. write/edit patterns use `target: 'file_path'` so content can never trigger them.

Legacy argv mode (`runGuard(['Write', '/etc/passwd'])`) still works because `extractTarget` falls back to the raw input string when JSON parsing fails.

## Related

- Fix commit: `ff9aafb`
- Regression test: `hooks/scripts/__tests__/pre-tool-guard.test.js` (`describe: regression: write/edit content must not trigger path patterns`)
- 6 new tests added; 32/32 passing

## Notes

- This record is the first dogfood case for `/vibe.regress`
- root-cause-tag `validation`: the matching surface was not narrowed to the right field
- Bash patterns are unaffected: argv mode and stdin both deliver `command` as a single string
