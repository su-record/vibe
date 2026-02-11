# P2 - FTS5 MATCH Query Injection

## Category: Security (OWASP A03:2021)

## Files
- `src/lib/memory/MemoryStorage.ts:363`
- `src/lib/memory/MemorySearch.ts:78,139,150`
- `src/lib/memory/SessionRAGStore.ts:442,551,696,797`
- `src/lib/memory/SessionRAGRetriever.ts:268`

## Description
FTS5 MATCH queries accept raw user strings. While not traditional SQL injection, malicious FTS5 syntax can cause DoS or information disclosure.

## Fix
Sanitize FTS5 input by double-quoting:

```typescript
const safeQuery = `"${query.replace(/"/g, '""')}"`;
```

Or strip FTS5 operators: AND, OR, NOT, NEAR, *, {, }, ^

## Estimated Scope
4 files, ~8 MATCH call sites
