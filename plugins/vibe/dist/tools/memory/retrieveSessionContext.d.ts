import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const retrieveSessionContextDefinition: ToolDefinition;
export declare function retrieveSessionContext(args: {
    query: string;
    sessionId?: string;
    limit?: number;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=retrieveSessionContext.d.ts.map