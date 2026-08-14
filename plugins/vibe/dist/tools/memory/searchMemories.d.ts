import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const searchMemoriesDefinition: ToolDefinition;
export declare function searchMemoriesHandler(args: {
    query: string;
    category?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=searchMemories.d.ts.map