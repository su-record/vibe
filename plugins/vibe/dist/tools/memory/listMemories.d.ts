import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const listMemoriesDefinition: ToolDefinition;
export declare function listMemories(args: {
    category?: string;
    limit?: number;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=listMemories.d.ts.map