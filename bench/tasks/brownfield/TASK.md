# Add a `lines` rule to the `file` check

This is the vibe 4 repository (TypeScript, `npm run build`, `npm test`). Add one rule to the `file` check:

```yaml
check: { type: file, path: <file>, lines: { max: N } }
```

It fails when the file has more than N lines, with a reason that names the count. Wire it wherever the other `file` rules live: the scenario validation (`lines` alone must count as a complete rule), the file check itself, the `file` row of the check table in README.md, and the scope skill's list of check types. Keep `npm run build` and `npm test` green, and keep `vibe size src --max-file 400 --max-function 50` within limits.
