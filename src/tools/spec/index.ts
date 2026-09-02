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

// Execution Packet Compiler
export {
  compileExecutionPacket,
  getHarnessProfile,
  validateExecutionPacket,
  writeExecutionPacket,
} from './executionPacket.js';
export type {
  CompileExecutionPacketInput,
  CompileExecutionPacketResult,
  ExecutionPacket,
  ExecutionPacketFileInput,
  HarnessProfile,
  HarnessProfileName,
  PacketError,
  PacketErrorCode,
  ValidateExecutionPacketInput,
  ValidateExecutionPacketResult,
  WriteExecutionPacketResult,
} from './executionPacket.js';

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

// SPEC Code Guard — 산출물이 하류(run/verify)로 넘어가기 전 노드 단위 검사
export {
  validateSpecDocument,
  formatSpecValidation,
  featureSlugFromPath,
} from './validateSpecDocument.js';
export type {
  SpecValidationResult,
  SpecFinding,
  SpecFindingSeverity,
} from './validateSpecDocument.js';

// SPEC lifecycle — 닫힌 Status/Class 집합과 Anchors 규율 (CI 게이트가 같은 정의를 import 한다)
export {
  SPEC_STATUSES,
  SPEC_CLASSES,
  ANCHOR_REQUIRED_CLASSES,
  parseSpecLifecycle,
  checkSpecLifecycle,
  anchorsRequired,
  isLifecycleExempt,
} from './specLifecycle.js';
export type {
  SpecStatus,
  SpecClass,
  SpecLifecycleHeader,
  LifecycleFinding,
} from './specLifecycle.js';
