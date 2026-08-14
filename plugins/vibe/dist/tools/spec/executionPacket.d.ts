export type HarnessProfileName = 'codex' | 'claude-code';
export interface CompileExecutionPacketInput {
    canonicalSpec: string;
    canonicalSpecPath: string;
    profile: HarnessProfileName;
    selectedRequirementIds?: string[];
}
export interface PacketContractItem {
    id: string;
    description: string;
    verifiedBy: string;
}
export interface PacketRequirement {
    id: string;
    description: string;
    doneCriterionIds: string[];
}
export interface PacketEvidence {
    criterionId: string;
    evidence: string;
}
export interface SourcePointer {
    id: string;
    path: string;
    line: number;
}
export interface HarnessProfile {
    name: HarnessProfileName;
    contextBudget: number;
    requiredSections: string[];
    isolationPolicy: {
        reloadPerScenario: boolean;
        includeExplorationLogs: boolean;
        stateSource: 'disk';
    };
}
export interface ExecutionPacket {
    schemaVersion: '1.0.0';
    compilerVersion: '1.0.0';
    profile: HarnessProfileName;
    canonicalSpecPath: string;
    canonicalSpecHash: string;
    requirements: PacketRequirement[];
    constraints: string[];
    rejectedAlternatives: string[];
    doneCriteria: PacketContractItem[];
    evidenceRequired: PacketEvidence[];
    contextSources: string[];
    assumptions: string[];
    isolationPolicy: HarnessProfile['isolationPolicy'];
    contextBudget: number;
    sourcePointers: SourcePointer[];
}
export type PacketErrorCode = 'MISSING_DONE_CRITERIA' | 'MISSING_REQUIRED_SECTION' | 'MISSING_EVIDENCE' | 'UNKNOWN_EVIDENCE_ID' | 'UNKNOWN_REQUIREMENT_ID' | 'BUDGET_EXCEEDED' | 'INVALID_PATH' | 'FILE_IO' | 'INVALID_PROFILE' | 'EMPTY_SELECTION' | 'INVALID_REQUIREMENT_MAPPING';
export interface PacketError {
    code: PacketErrorCode;
    message: string;
    sourceId?: string;
    sourcePointer?: Omit<SourcePointer, 'id'>;
}
export type CompileExecutionPacketResult = {
    ok: true;
    packet: ExecutionPacket;
    audit: {
        preservedCriterionIds: string[];
    };
} | {
    ok: false;
    errors: PacketError[];
};
export declare function compileExecutionPacket(input: CompileExecutionPacketInput): CompileExecutionPacketResult;
export declare function getHarnessProfile(name: HarnessProfileName): HarnessProfile;
export interface ExecutionPacketFileInput {
    projectPath: string;
    specPath: string;
    profile: HarnessProfileName;
    selectedRequirementIds?: string[];
}
export type WriteExecutionPacketResult = {
    ok: true;
    packetPath: string;
    packet: ExecutionPacket;
} | {
    ok: false;
    errors: PacketError[];
};
export interface ValidateExecutionPacketInput {
    projectPath: string;
    specPath: string;
    packetPath: string;
    selectedRequirementIds?: string[];
}
export type ValidateExecutionPacketResult = {
    valid: true;
} | {
    valid: false;
    code: 'INVALID_PACKET' | 'STALE_PACKET';
    message: string;
};
export declare function writeExecutionPacket(input: ExecutionPacketFileInput): WriteExecutionPacketResult;
export declare function validateExecutionPacket(input: ValidateExecutionPacketInput): ValidateExecutionPacketResult;
//# sourceMappingURL=executionPacket.d.ts.map