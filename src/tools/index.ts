/**
 * Vibe Tools - CLI 없이 도구만 export
 *
 * 사용법:
 *   node -e "require('@su-record/vibe/tools').startSession({}).then(console.log)"
 */

// Memory tools
export { startSession } from './memory/startSession.js';
export { autoSaveContext } from './memory/autoSaveContext.js';
export { saveMemory } from './memory/saveMemory.js';
export { recallMemory } from './memory/recallMemory.js';
export { listMemories } from './memory/listMemories.js';
export { deleteMemory } from './memory/deleteMemory.js';
export { updateMemory } from './memory/updateMemory.js';
export { searchMemoriesHandler as searchMemories } from './memory/searchMemories.js';
export { searchMemoriesAdvanced } from './memory/searchMemoriesAdvanced.js';
export { linkMemories } from './memory/linkMemories.js';
export { getMemoryGraph } from './memory/getMemoryGraph.js';
export { createMemoryTimeline } from './memory/createMemoryTimeline.js';
export { restoreSessionContext } from './memory/restoreSessionContext.js';
export { prioritizeMemory } from './memory/prioritizeMemory.js';
export { getSessionContext } from './memory/getSessionContext.js';

// Semantic tools
export { findSymbol } from './semantic/findSymbol.js';
export { findReferences } from './semantic/findReferences.js';
export { analyzeDependencyGraph } from './semantic/analyzeDependencyGraph.js';

// Convention tools
export { analyzeComplexity } from './convention/analyzeComplexity.js';
export { validateCodeQuality } from './convention/validateCodeQuality.js';
export { checkCouplingCohesion } from './convention/checkCouplingCohesion.js';
export { suggestImprovements } from './convention/suggestImprovements.js';
export { applyQualityRules } from './convention/applyQualityRules.js';

// UI tools
export { previewUiAscii } from './ui/previewUiAscii.js';

// Time tools
export { getCurrentTime } from './time/getCurrentTime.js';

// Lib exports (for advanced usage)
export { MemoryManager } from '../lib/MemoryManager.js';
export { ProjectCache } from '../lib/ProjectCache.js';
export { ContextCompressor } from '../lib/ContextCompressor.js';

// Model routing & iteration tracking (v2.5.7)
export {
  routeToModel,
  routeFromSpec,
  selectAgentTier,
  extractComplexitySignals,
  calculateComplexityScore,
} from '../lib/ModelRouter.js';

export {
  startIteration,
  startPhase,
  completePhase,
  failPhase,
  completeIteration,
  getCurrentState,
  formatProgress,
  formatPhaseStart,
  formatPhaseComplete,
  formatIterationComplete,
  extractPhaseNames,
} from '../lib/IterationTracker.js';

export {
  validateSkillQuality,
  validateBeforeSave,
  classifySkill,
  suggestPrincipleFormat,
} from '../lib/SkillQualityGate.js';

// Orchestrate workflow (v2.5.11)
export {
  checkIntentGate,
  assessCodebase,
  createDelegationPlan,
  createVerificationChecklist,
  formatOrchestrationStatus,
  shouldRunInBackground,
} from '../lib/OrchestrateWorkflow.js';

// UltraQA (v2.5.11)
export {
  createQASession,
  getCommandForGoal,
  recordCycleResult,
  shouldContinue,
  generateDiagnosisPrompt,
  generateFixPrompt,
  formatQAStatus,
  parseQAGoals,
  describeUltraQAWorkflow,
} from '../lib/UltraQA.js';

// DeepInit (v2.5.11)
export {
  detectDirectoryPurpose,
  isEntryPoint,
  generateAgentsMd,
  formatAgentsMd,
  preserveManualNotes,
  generateNavigationHeader,
  describeDeepInitWorkflow,
} from '../lib/DeepInit.js';

// Skill Frontmatter (v2.5.11)
export {
  parseSkillFrontmatter,
  generateSkillFrontmatter,
  createSkillFile,
  validateSkillMetadata,
  mergeWithDefaults,
  extractTriggersFromTemplate,
  substituteTemplateVars,
} from '../lib/SkillFrontmatter.js';
