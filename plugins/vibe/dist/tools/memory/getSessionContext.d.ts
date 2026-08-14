import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const getSessionContextDefinition: ToolDefinition;
interface GetSessionContextArgs {
    projectName?: string;
    category?: string;
    memoryLimit?: number;
    includeGraph?: boolean;
    includeTimeline?: boolean;
    timeRange?: '1d' | '7d' | '30d' | 'all';
    projectPath?: string;
}
export declare function getSessionContext(args: GetSessionContextArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=getSessionContext.d.ts.map