# P2 - Missing Tests for Critical Modules

## Category: Test Coverage

## Priority modules needing tests (in order)
1. `src/lib/llm/utils/retry.ts` - Pure functions, high impact
2. `src/lib/llm/utils/stream.ts` - SSE parser, all LLM responses
3. `src/lib/llm/auth/ApiKeyManager.ts` - Auth infrastructure
4. `src/lib/llm/auth/ConfigManager.ts` - Config management
5. `src/orchestrator/PhasePipeline.ts` - Core pipeline
6. `src/orchestrator/AgentExecutor.ts` - Agent lifecycle
7. `src/orchestrator/SessionStore.ts` - Session management
8. `src/tools/semantic/findSymbol.ts` - Public tool
9. `src/tools/semantic/findReferences.ts` - Public tool
10. `src/tools/semantic/analyzeDependencyGraph.ts` - Public tool

## Existing test quality issues
- Conditional assertions in `SessionRAGRetriever.test.ts:87-93,135-139,194-199`
- Weak assertions in `analyzeComplexity.test.ts` and `validateCodeQuality.test.ts`
- Missing error path tests in `BackgroundManager.test.ts`

## Coverage config gap
`vitest.config.ts` excludes `src/orchestrator/` from coverage reporting
