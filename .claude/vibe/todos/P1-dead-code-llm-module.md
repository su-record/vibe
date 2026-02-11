# P1 - Dead Code: Entire `src/lib/llm/` module (~400 lines)

## Category: Dead Code / Simplicity

## Files
- `src/lib/llm/index.ts`
- `src/lib/llm/types.ts`
- `src/lib/llm/auth/ApiKeyManager.ts`
- `src/lib/llm/auth/ConfigManager.ts`
- `src/lib/llm/auth/index.ts`
- `src/lib/llm/utils/retry.ts`
- `src/lib/llm/utils/stream.ts`
- `src/lib/llm/utils/index.ts`

## Description
The entire module is never imported by any production code. The actual GPT/Gemini implementations use their own separate auth/streaming/retry code. This was a planned "unified LLM abstraction" that was never completed (confirmed by commented-out `// export * from './providers/index.js';`).

## Fix
Delete `src/lib/llm/` directory. Remove re-export from `src/cli/llm.ts`.

## Impact
Removes ~400 lines of dead code and resolves 3 additional duplicate findings.
