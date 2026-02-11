# P1 - Command Injection in execSync calls

## Category: Security (OWASP A03:2021)

## Files
- `src/tools/spec/specVersioning.ts:181,202,246,293-297`
- `src/lib/PythonParser.ts:249`

## Description
Multiple `execSync` calls interpolate user-influenced variables into template strings without sanitization. A malicious `featureName`, `baseRef`, or `action` could execute arbitrary commands.

## Fix
Replace `execSync` with `execFileSync` (no shell invocation) and pass arguments as arrays:

```typescript
// Before
execSync(`git tag -a "${tag}" -m "${tagMessage}"`, { encoding: 'utf-8' });

// After
import { execFileSync } from 'child_process';
execFileSync('git', ['tag', '-a', tag, '-m', tagMessage], { encoding: 'utf-8' });
```

For PythonParser, use `spawn` with `stdio` options instead of shell piping.

## Estimated Scope
2 files, ~10 call sites
