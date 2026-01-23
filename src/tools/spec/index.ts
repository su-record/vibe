/**
 * SPEC Tools - PRD-to-SPEC 자동화 도구 모음
 * v2.6.0
 */

// Requirement ID
export {
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
  getCounterStatus
} from './requirementId.js';

// PRD Parser
export {
  parsePRD,
  parsePRDFile
} from './prdParser.js';
export type {
  Requirement,
  ParsedPRD,
  PRDMetadata
} from './prdParser.js';

// SPEC Generator
export {
  generateSpec
} from './specGenerator.js';
export type {
  SpecGeneratorOptions,
  GeneratedSpec
} from './specGenerator.js';

// Traceability Matrix
export {
  generateTraceabilityMatrix,
  formatMatrixAsMarkdown,
  formatMatrixAsHtml
} from './traceabilityMatrix.js';
export type {
  TraceItem,
  TraceabilityMatrix,
  TraceSummary,
  TraceMatrixOptions
} from './traceabilityMatrix.js';

// SPEC Versioning
export {
  bumpSpecVersion,
  extractVersion,
  incrementVersion,
  generateChangelog,
  createGitTag,
  detectSpecChanges,
  getLatestSpecCommit,
  loadVersionHistory,
  saveVersionHistory,
  createBaseline
} from './specVersioning.js';
export type {
  SpecVersion,
  ChangeEntry,
  VersionHistory,
  BumpType
} from './specVersioning.js';
