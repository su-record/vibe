# P3 - Cleanup Backlog

## Dead Code Removal
- `ContextCompressor.extractKeyEntities` (never called) - `src/lib/ContextCompressor.ts:367`
- `IterationTracker.detectSplitSpec` (stub, never called) - `src/lib/IterationTracker.ts:215-228`
- `ReviewRace.extractIssueNumber` (never called) - `src/lib/ReviewRace.ts:189-192`
- `registerMcpServers` (no-op) - `src/cli/setup/GlobalInstaller.ts:140-142`
- `removeEmailFromConfigIfNoToken` in llm/auth (no-op) - `src/lib/llm/auth/index.ts:93-104`
- Unused `ToolDefinition` constants in time/ui tools
- `addObservation`/`searchObservations` not exported from top-level

## Code Deduplication
- `sleep()`/`delay()` reimplemented 5 times - consolidate from `src/lib/utils.ts`
- `getCoreConfigDir()` duplicated in setup vs postinstall
- `ensureDir()`/`copyDirRecursive()` duplicated 4 locations
- `reviewWithGPT`/`reviewWithGemini` near-identical functions in ReviewRace.ts

## Style / Convention
- `ClaudeModel` type `| string` negates union - `src/orchestrator/types.ts:8-13`
- Hooks scripts are plain JS (17 files) - consider JSDoc annotations
- ReDoS risk in `hooks/scripts/skill-injector.js:94` - escape regex metacharacters
- `DEFAULT_SKILLS` inline content (~170 lines) never used - `src/lib/SkillRepository.ts:319-495`
