/**
 * Core Tools - CLI 없이 도구만 export
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

// Session RAG tools
export { saveSessionItem } from './memory/saveSessionItem.js';
export { retrieveSessionContext } from './memory/retrieveSessionContext.js';
export { manageGoals } from './memory/manageGoals.js';

// Reflection tools
export { reflectNow, searchReflections, getSessionReflections } from './memory/reflectionTools.js';

// Reflection types
export type {
  Reflection, ReflectionInput, ReflectionType, ReflectionTrigger,
} from '../infra/lib/memory/ReflectionStore.js';

// Session RAG types
export type {
  Decision, DecisionInput, Constraint, ConstraintInput,
  Goal, GoalInput, Evidence, EvidenceInput,
  DecisionStatus, ConstraintType, ConstraintSeverity,
  GoalStatus, EvidenceType, EvidenceStatus, SessionRAGStats,
} from '../infra/lib/memory/SessionRAGStore.js';
export type {
  RetrievalOptions, SessionRAGResult, ScoredItem, ScoreBreakdown,
} from '../infra/lib/memory/SessionRAGRetriever.js';

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
export { searchUiUx } from './ui/searchUiUx.js';
export { searchUiUxStack } from './ui/searchUiUxStack.js';
export { generateDesignSystem } from './ui/generateDesignSystem.js';
export { persistDesignSystem } from './ui/persistDesignSystem.js';

// Interaction tools
export {
  askUser,
  askUserQuick,
  createQuestionFromTemplate,
  createRequiredQuestionSet,
  generateQuestionId,
  formatQuestionAsMarkdown,
  formatQuestionsForUser,
  parseUserResponse,
  QUESTION_TEMPLATES,
} from './interaction/index.js';

export type {
  Question,
  QuestionCategory,
  QuestionOption,
  QuestionResponse,
  QuestionType,
  AskUserInput,
  AskUserOutput,
  AskUserParams,
} from './interaction/index.js';

// Time tools
export { getCurrentTime } from './time/getCurrentTime.js';

// Lib exports (for advanced usage)
export { MemoryManager } from '../infra/lib/MemoryManager.js';
export { ProjectCache } from '../infra/lib/ProjectCache.js';
export { ContextCompressor } from '../infra/lib/ContextCompressor.js';

// UI/UX Design Intelligence
export {
  CsvDataLoader,
  Bm25Engine,
  SearchService,
  DesignSystemGenerator,
} from '../infra/lib/ui-ux/index.js';

export type {
  SearchDomain,
  StackName,
  SearchResult,
  SearchResultItem,
  DesignSystem,
  DesignSystemColorPalette,
  DesignSystemTypography,
  DesignSystemStyle,
  DesignSystemLayout,
  DecisionRules,
} from '../infra/lib/ui-ux/types.js';

// PRD-to-SPEC Tools
export {
  // Requirement ID
  generateRequirementId,
  generateRequirementIds,
  validateRequirementId,
  checkDuplicateId,
  registerExistingId,
  registerExistingIds,
  extractFeatureFromId,
  extractNumberFromId,
  getIdsByFeature,
  getAllUsedIds,
  resetCounters,
  getCounterStatus,
  // PRD Parser
  parsePRD,
  parsePRDFile,
  // SPEC Generator
  generateSpec,
  // Traceability Matrix
  generateTraceabilityMatrix,
  formatMatrixAsMarkdown,
  formatMatrixAsHtml,
} from './spec/index.js';

export type {
  Requirement,
  ParsedPRD,
  PRDMetadata,
  SpecGeneratorOptions,
  GeneratedSpec,
  // Traceability Matrix types
  TraceItem,
  TraceabilityMatrix,
  TraceSummary,
  TraceMatrixOptions,
} from './spec/index.js';

// ─── Loop Breaker ───
export { LoopBreaker, LOOP_LIMITS } from '../infra/lib/LoopBreaker.js';
export type {
  LoopEvent,
  LoopBreakResult,
  LoopCounters,
  LoopLimitOptions,
} from '../infra/lib/LoopBreaker.js';

// ─── Deprecation Detection ───
export { DeprecationDetector } from '../infra/lib/evolution/DeprecationDetector.js';
export type {
  DeprecationCandidate,
  DeprecationReport,
} from '../infra/lib/evolution/DeprecationDetector.js';

// ─── Automation Level ───
export {
  AUTOMATION_LEVELS,
  KEYWORD_LEVEL_MAP,
  detectAutomationLevel,
  getAutomationLevel,
  needsConfirmation,
  createTrustScore,
  recordTrustSuccess,
  recordTrustFailure,
  getRecommendedLevel,
} from '../infra/lib/AutomationLevel.js';
export type {
  AutomationLevelNumber,
  AutomationLevel,
  AutomationAction,
  TrustScore,
} from '../infra/lib/AutomationLevel.js';

// ─── Decision Tracer ───
export { DecisionTracer } from '../infra/lib/DecisionTracer.js';
export type {
  DecisionRecord,
  DecisionCategory,
  DecisionContext,
  DecisionOutcome,
  DecisionInput as TracerDecisionInput,
  FeatureSummary,
} from '../infra/lib/DecisionTracer.js';

// ─── Verification Loop ───
export {
  createLoop,
  calculateAchievementRate,
  recordVerification,
  getUnmetRequirements,
  formatVerificationResult,
  formatLoopSummary,
  isImproving,
  DEFAULT_VERIFICATION_CONFIG,
} from '../infra/lib/VerificationLoop.js';
export type {
  RequirementResult,
  VerificationResult,
  VerificationLoopConfig,
  LoopState,
  VerificationAction,
} from '../infra/lib/VerificationLoop.js';

// ─── Interactive Checkpoint ───
export {
  createRequirementsCheckpoint,
  createArchitectureCheckpoint,
  createScopeCheckpoint,
  createVerificationCheckpoint,
  createFixStrategyCheckpoint,
  formatCheckpoint,
  resolveCheckpoint,
  autoResolveCheckpoint,
  createHistory,
  addToHistory,
} from '../infra/lib/InteractiveCheckpoint.js';
export type {
  CheckpointType,
  CheckpointOption,
  Checkpoint,
  CheckpointResult,
  CheckpointHistory,
} from '../infra/lib/InteractiveCheckpoint.js';

// ─── Skill Parity Testing ───
export { ParityTester, PARITY_THRESHOLDS } from '../infra/lib/evolution/ParityTester.js';
export type {
  ParityTestResult,
  ModelVersion,
} from '../infra/lib/evolution/ParityTester.js';
