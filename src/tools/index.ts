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

// ast-grep Tools
export {
  astGrepSearch,
  astGrepReplace,
  astGrepSearchDefinition,
  astGrepReplaceDefinition,
} from './semantic/astGrep.js';

// LSP Tools
export {
  lspHover,
  lspGotoDefinition,
  lspFindReferences,
  lspDocumentSymbols,
  lspWorkspaceSymbols,
  lspDiagnostics,
  lspDiagnosticsDirectory,
  lspRename,
  lspCodeActions,
  lspHoverDefinition,
  lspGotoDefinitionDefinition,
  lspFindReferencesDefinition,
  lspDocumentSymbolsDefinition,
  lspWorkspaceSymbolsDefinition,
  lspDiagnosticsDefinition,
  lspDiagnosticsDirectoryDefinition,
  lspRenameDefinition,
  lspCodeActionsDefinition,
} from './semantic/lsp.js';

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

// Model routing & iteration tracking
export {
  routeToModel,
  routeFromSpec,
  selectAgentTier,
  extractComplexitySignals,
  calculateComplexityScore,
} from '../infra/lib/ModelRouter.js';

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
} from '../infra/lib/IterationTracker.js';

export {
  validateSkillQuality,
  validateBeforeSave,
  classifySkill,
  suggestPrincipleFormat,
} from '../infra/lib/SkillQualityGate.js';

// Orchestrate workflow
export {
  checkIntentGate,
  assessCodebase,
  createDelegationPlan,
  createVerificationChecklist,
  formatOrchestrationStatus,
  shouldRunInBackground,
} from '../infra/lib/OrchestrateWorkflow.js';

// UltraQA
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
} from '../infra/lib/UltraQA.js';

// DeepInit
export {
  detectDirectoryPurpose,
  isEntryPoint,
  generateAgentsMd,
  formatAgentsMd,
  preserveManualNotes,
  generateNavigationHeader,
  describeDeepInitWorkflow,
} from '../infra/lib/DeepInit.js';

// Skill Frontmatter
export {
  parseSkillFrontmatter,
  generateSkillFrontmatter,
  createSkillFile,
  validateSkillMetadata,
  mergeWithDefaults,
  extractTriggersFromTemplate,
  substituteTemplateVars,
} from '../infra/lib/SkillFrontmatter.js';

// Skill Repository
export {
  SkillRepository,
  getGlobalSkillsDir,
  getBundledSkillsDir,
  ensureDefaultSkills,
  seedInlineDefaultSkills,
  DEFAULT_SKILLS,
  getDefaultSkills,
} from '../infra/lib/SkillRepository.js';

export type { SkillInfo, SkillRepositoryConfig } from '../infra/lib/SkillRepository.js';

// Rule Build System
export {
  parseRuleFile,
  generateMarkdown,
  buildRulesDocument,
  extractTestCases,
  extractTestCasesFromDir,
  validateRule,
  getImpactColor,
  compareImpact,
  IMPACT_ORDER,
} from '../infra/lib/RuleBuildSystem.js';

export type {
  ImpactLevel,
  CodeExample,
  Rule,
  Section,
  RulesDocument,
  RuleFile,
  TestCase,
} from '../infra/lib/RuleBuildSystem.js';

// Framework Detector
export {
  detectFramework,
  detectFrameworkFromContent,
  getFrameworkRecommendations,
  formatDetectionResult,
  isFramework,
  getSupportedFrameworks,
  FRAMEWORKS,
} from '../infra/lib/FrameworkDetector.js';

export type {
  FrameworkInfo,
  PackageJson,
  DetectionResult,
} from '../infra/lib/FrameworkDetector.js';

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
  // SPEC Versioning
  bumpSpecVersion,
  extractVersion,
  incrementVersion,
  generateChangelog,
  createGitTag,
  detectSpecChanges,
  getLatestSpecCommit,
  loadVersionHistory,
  saveVersionHistory,
  createBaseline,
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
  // SPEC Versioning types
  SpecVersion,
  ChangeEntry,
  VersionHistory,
  BumpType,
} from './spec/index.js';

// Review Race
export {
  raceReview,
  formatRaceResult,
  checkLLMAvailability,
} from '../infra/lib/ReviewRace.js';

export type {
  RaceReviewResult,
  RaceReviewOptions,
  LLMProvider,
  Priority,
  ReviewType,
  RaceReviewIssue,
  RaceLLMResult,
  RaceCrossValidatedIssue,
} from '../infra/lib/ReviewRace.js';
