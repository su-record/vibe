#!/usr/bin/env node
/**
 * core CLI — SPEC-driven AI coding framework for Claude Code, Codex, and Antigravity
 */
export * from '../infra/lib/MemoryManager.js';
export * from '../infra/lib/ProjectCache.js';
export { PhaseInfo, ProgressState, getProgressPath, loadProgress, saveProgress, initProgress, updatePhase, completeTask, recordCommit, incrementSession, formatProgressState, getProgressSummary, writeProgressText, } from '../infra/lib/IterationTracker.js';
export { saveMemory } from '../tools/memory/saveMemory.js';
export { recallMemory } from '../tools/memory/recallMemory.js';
export { listMemories } from '../tools/memory/listMemories.js';
export { deleteMemory } from '../tools/memory/deleteMemory.js';
export { updateMemory } from '../tools/memory/updateMemory.js';
export { searchMemoriesHandler as searchMemories } from '../tools/memory/searchMemories.js';
export { linkMemories } from '../tools/memory/linkMemories.js';
export { getMemoryGraph } from '../tools/memory/getMemoryGraph.js';
export { createMemoryTimeline } from '../tools/memory/createMemoryTimeline.js';
export { searchMemoriesAdvanced } from '../tools/memory/searchMemoriesAdvanced.js';
export { startSession } from '../tools/memory/startSession.js';
export { autoSaveContext } from '../tools/memory/autoSaveContext.js';
export { restoreSessionContext } from '../tools/memory/restoreSessionContext.js';
export { prioritizeMemory } from '../tools/memory/prioritizeMemory.js';
export { getSessionContext } from '../tools/memory/getSessionContext.js';
export { analyzeComplexity } from '../tools/convention/analyzeComplexity.js';
export { validateCodeQuality } from '../tools/convention/validateCodeQuality.js';
export { checkCouplingCohesion } from '../tools/convention/checkCouplingCohesion.js';
export { suggestImprovements } from '../tools/convention/suggestImprovements.js';
export { applyQualityRules } from '../tools/convention/applyQualityRules.js';
export { previewUiAscii } from '../tools/ui/previewUiAscii.js';
export { getCurrentTime } from '../tools/time/getCurrentTime.js';
//# sourceMappingURL=index.d.ts.map