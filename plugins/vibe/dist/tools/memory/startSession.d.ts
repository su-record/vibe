import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const startSessionDefinition: ToolDefinition;
export declare function startSession(args: {
    greeting?: string;
    loadMemory?: boolean;
    restoreContext?: boolean;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=startSession.d.ts.map