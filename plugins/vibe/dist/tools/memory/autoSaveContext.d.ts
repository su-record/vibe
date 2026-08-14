import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const autoSaveContextDefinition: ToolDefinition;
export declare function autoSaveContext(args: {
    urgency: string;
    contextType: string;
    sessionId?: string;
    summary?: string;
    fullContext?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=autoSaveContext.d.ts.map