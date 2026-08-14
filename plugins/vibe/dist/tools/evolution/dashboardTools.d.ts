import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const evolutionStatusDefinition: ToolDefinition;
export declare function evolutionStatus(args: {
    projectPath?: string;
}): Promise<ToolResult>;
export declare const evolutionApproveDefinition: ToolDefinition;
export declare function evolutionApprove(args: {
    generationId: string;
    projectPath?: string;
}): Promise<ToolResult>;
export declare const evolutionRejectDefinition: ToolDefinition;
export declare function evolutionReject(args: {
    generationId: string;
    projectPath?: string;
}): Promise<ToolResult>;
export declare const evolutionDisableDefinition: ToolDefinition;
export declare function evolutionDisable(args: {
    generationId: string;
    projectPath?: string;
}): Promise<ToolResult>;
export declare const evolutionRollbackDefinition: ToolDefinition;
export declare function evolutionRollback(args: {
    generationId: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=dashboardTools.d.ts.map