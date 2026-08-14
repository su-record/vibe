import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const restoreSessionContextDefinition: ToolDefinition;
export declare function restoreSessionContext(args: {
    sessionId: string;
    restoreLevel?: string;
    filterType?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=restoreSessionContext.d.ts.map