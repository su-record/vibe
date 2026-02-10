/**
 * Core Tools - CLI 없이 도구만 export
 *
 * 사용법:
 *   node -e "require('@su-record/core/tools').startSession({}).then(console.log)"
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

// Reflection tools (self-evolution Phase 1)
export { reflectNow, searchReflections, getSessionReflections } from './memory/reflectionTools.js';

// Reflection types
export type {
  Reflection, ReflectionInput, ReflectionType, ReflectionTrigger,
} from '../lib/memory/ReflectionStore.js';

// Session RAG types
export type {
  Decision, DecisionInput, Constraint, ConstraintInput,
  Goal, GoalInput, Evidence, EvidenceInput,
  DecisionStatus, ConstraintType, ConstraintSeverity,
  GoalStatus, EvidenceType, EvidenceStatus, SessionRAGStats,
} from '../lib/memory/SessionRAGStore.js';
export type {
  RetrievalOptions, SessionRAGResult, ScoredItem, ScoreBreakdown,
} from '../lib/memory/SessionRAGRetriever.js';

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

// Interaction tools (v2.6.1)
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

// Browser tools (Phase 1: pc-control)
export {
  browserSnapshot,
  browserAct,
  browserNavigate,
  browserScreenshot,
  browserStatus,
  shutdownBrowserService,
  browserSnapshotDefinition,
  browserActDefinition,
  browserNavigateDefinition,
  browserScreenshotDefinition,
  browserStatusDefinition,
} from './browser/index.js';

// Google tools (Phase 2: pc-control)
export {
  googleAuth,
  googleGmailSend,
  googleGmailSearch,
  googleGmailReport,
  googleDriveUpload,
  googleDriveDownload,
  googleDriveList,
  googleSheetsRead,
  googleSheetsWrite,
  googleCalendarList,
  googleCalendarCreate,
  shutdownGoogleService,
  googleAuthDefinition,
  googleGmailSendDefinition,
  googleGmailSearchDefinition,
  googleGmailReportDefinition,
  googleDriveUploadDefinition,
  googleDriveDownloadDefinition,
  googleDriveListDefinition,
  googleSheetsReadDefinition,
  googleSheetsWriteDefinition,
  googleCalendarListDefinition,
  googleCalendarCreateDefinition,
} from './google/index.js';

// Voice tools (Phase 3: pc-control)
export {
  voiceStatus,
  ttsSpeak,
  sttTranscribe,
  shutdownVoiceService,
  voiceStatusDefinition,
  ttsSpeakDefinition,
  sttTranscribeDefinition,
} from './voice/index.js';

// Vision tools (Phase 4: pc-control)
export {
  visionStart,
  visionStop,
  visionMode,
  visionSnapshot,
  visionAsk,
  shutdownVisionService,
  visionStartDefinition,
  visionStopDefinition,
  visionModeDefinition,
  visionSnapshotDefinition,
  visionAskDefinition,
} from './vision/index.js';

// Sandbox tools (Phase 5: pc-control)
export {
  sandboxStatus,
  sandboxExec,
  sandboxBrowserTool,
  shutdownSandboxService,
  sandboxStatusDefinition,
  sandboxExecDefinition,
  sandboxBrowserDefinition,
} from './sandbox/index.js';

// Integration tools (Phase 6: pc-control)
export {
  pcStatus,
  pcCommand,
  pcModules,
  shutdownIntegrationService,
  pcStatusDefinition,
  pcCommandDefinition,
  pcModulesDefinition,
} from './integration/index.js';

// Lib exports (for advanced usage)
export { MemoryManager } from '../lib/MemoryManager.js';
export { ProjectCache } from '../lib/ProjectCache.js';
export { ContextCompressor } from '../lib/ContextCompressor.js';

// UI/UX Design Intelligence
export {
  CsvDataLoader,
  Bm25Engine,
  SearchService,
  DesignSystemGenerator,
} from '../lib/ui-ux/index.js';

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
} from '../lib/ui-ux/types.js';

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

// Skill Repository (v2.5.12)
export {
  SkillRepository,
  getGlobalSkillsDir,
  getBundledSkillsDir,
  ensureDefaultSkills,
  seedInlineDefaultSkills,
  DEFAULT_SKILLS,
} from '../lib/SkillRepository.js';

export type { SkillInfo, SkillRepositoryConfig } from '../lib/SkillRepository.js';

// Rule Build System (v2.5.15)
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
} from '../lib/RuleBuildSystem.js';

export type {
  ImpactLevel,
  CodeExample,
  Rule,
  Section,
  RulesDocument,
  RuleFile,
  TestCase,
} from '../lib/RuleBuildSystem.js';

// Framework Detector (v2.5.15)
export {
  detectFramework,
  detectFrameworkFromContent,
  getFrameworkRecommendations,
  formatDetectionResult,
  isFramework,
  getSupportedFrameworks,
  FRAMEWORKS,
} from '../lib/FrameworkDetector.js';

export type {
  FrameworkInfo,
  PackageJson,
  DetectionResult,
} from '../lib/FrameworkDetector.js';

// PRD-to-SPEC Tools (v2.6.0)
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

// Review Race (v2.6.9) - Multi-LLM competitive review
export {
  raceReview,
  formatRaceResult,
  checkLLMAvailability,
} from '../lib/ReviewRace.js';

export type {
  RaceReviewResult,
  RaceReviewOptions,
  LLMProvider,
  Priority,
  ReviewType,
  RaceReviewIssue,
  RaceLLMResult,
  RaceCrossValidatedIssue,
} from '../lib/ReviewRace.js';
