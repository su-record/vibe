# P1 - `any` Type Usage (24 locations)

## Category: Type Safety

## Files (partial list)
- `src/tools/memory/getMemoryGraph.ts:124,181,197` - `any[]` for nodes/edges
- `src/tools/memory/createMemoryTimeline.ts:113,146,210` - `any[]` for memories
- `src/tools/memory/getSessionContext.ts:183,254,268` - `any[]` for memories/edges
- `src/tools/semantic/findReferences.ts:206` - `result: any`
- `src/tools/semantic/findSymbol.ts:232` - `result: any`
- `src/tools/semantic/analyzeDependencyGraph.ts:165` - `any[]`
- `src/tools/convention/analyzeComplexity.ts:298` - `{} as any`
- `src/tools/convention/checkCouplingCohesion.ts:73` - `{} as any`
- `src/lib/FrameworkDetector.ts:186` - `as any`
- `src/types/tool.ts:26,38` - `Record<string, any>`

## Fix
1. Create shared memory types (`MemoryNode`, `MemoryEdge`, `MemoryRecord`)
2. Create result interfaces for findSymbol/findReferences formatters
3. Replace `{} as any` with properly typed empty objects
4. Use `Record<string, unknown>` instead of `Record<string, any>`

## Estimated Scope
~12 files, ~24 call sites
