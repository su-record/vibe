/**
 * SPEC Tools - PRD-to-SPEC 자동화 도구 모음
 * v2.6.0
 */
export { generateRequirementId, generateRequirementIds, validateRequirementId, checkDuplicateId, registerExistingId, registerExistingIds, extractFeatureFromId, extractNumberFromId, getIdsByFeature, getAllUsedIds, resetCounters, getCounterStatus } from './requirementId.js';
export { parsePRD, parsePRDFile } from './prdParser.js';
export type { Requirement, ParsedPRD, PRDMetadata } from './prdParser.js';
export { generateSpec } from './specGenerator.js';
export type { SpecGeneratorOptions, GeneratedSpec } from './specGenerator.js';
export { compileExecutionPacket, getHarnessProfile, validateExecutionPacket, writeExecutionPacket, } from './executionPacket.js';
export type { CompileExecutionPacketInput, CompileExecutionPacketResult, ExecutionPacket, ExecutionPacketFileInput, HarnessProfile, HarnessProfileName, PacketError, PacketErrorCode, ValidateExecutionPacketInput, ValidateExecutionPacketResult, WriteExecutionPacketResult, } from './executionPacket.js';
export { generateTraceabilityMatrix, formatMatrixAsMarkdown, formatMatrixAsHtml } from './traceabilityMatrix.js';
export type { TraceItem, TraceabilityMatrix, TraceSummary, TraceMatrixOptions } from './traceabilityMatrix.js';
export { validateSpecDocument, formatSpecValidation, featureSlugFromPath, } from './validateSpecDocument.js';
export type { SpecValidationResult, SpecFinding, SpecFindingSeverity, } from './validateSpecDocument.js';
//# sourceMappingURL=index.d.ts.map