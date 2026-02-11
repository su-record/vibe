# P2 - Orchestrator index.ts God Module (513 lines)

## Category: Architecture

## File
- `src/orchestrator/index.ts`

## Description
Serves 3 roles simultaneously: barrel re-exporter, convenience API layer, and LLM integration facade. Each convenience function creates new `CoreOrchestrator` instead of using singleton.

## Fix
Split into:
- `index.ts` - pure re-exports only
- `convenience.ts` - convenience API using `getOrchestrator()` singleton
- `llm-facade.ts` - LLM integration wrapper functions

## Estimated Scope
1 file split into 3
