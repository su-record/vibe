import { ToolResult, ToolDefinition, SearchStrategy } from '../../infra/types/tool.js';
export declare const searchMemoriesAdvancedDefinition: ToolDefinition;
interface SearchMemoriesAdvancedArgs {
    query: string;
    strategy?: SearchStrategy;
    limit?: number;
    category?: string;
    startKey?: string;
    depth?: number;
    includeRelations?: boolean;
    projectPath?: string;
}
export declare function searchMemoriesAdvanced(args: SearchMemoriesAdvancedArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=searchMemoriesAdvanced.d.ts.map