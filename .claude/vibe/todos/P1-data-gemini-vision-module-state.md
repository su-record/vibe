# P1 - GeminiVision.ts Module-Level Mutable State

## Priority: P1 (Critical)
## Category: DATA
## Status: Manual fix required

## Description
`src/interface/vision/GeminiVision.ts` has module-level mutable globals (`tokenBucket`, `liveSession`) that cause data corruption when multiple callers use the functional API concurrently.

`GeminiVisionClass.ts` (class-based version) does NOT have this issue as state is per-instance.

## Current State
Both files coexist: functional (`GeminiVision.ts`) and class-based (`GeminiVisionClass.ts`) with ~280 lines of near-identical logic.

## Recommended Fix
1. Delete `src/interface/vision/GeminiVision.ts` (functional version)
2. Update all imports to use `GeminiVisionClass.ts`
3. Optionally rename `GeminiVisionClass.ts` to `GeminiVision.ts`

## Impact
- Removes ~280 lines of duplicated code
- Eliminates singleton state corruption risk
- Simplifies vision module architecture

## Files Affected
- `src/interface/vision/GeminiVision.ts` (delete)
- `src/interface/vision/GeminiVisionClass.ts` (keep)
- `src/interface/vision/index.ts` (update exports)
