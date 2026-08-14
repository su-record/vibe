import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const extractInsightsDefinition: ToolDefinition;
export declare function extractInsights(args: {
    limit?: number;
    projectPath?: string;
}): Promise<ToolResult>;
export declare const searchInsightsDefinition: ToolDefinition;
export declare function searchInsights(args: {
    query: string;
    limit?: number;
    projectPath?: string;
}): Promise<ToolResult>;
export declare const listSkillGapsDefinition: ToolDefinition;
export declare function listSkillGaps(args: {
    projectPath?: string;
}): Promise<ToolResult>;
export declare const insightStatsDefinition: ToolDefinition;
export declare function insightStats(args: {
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=insightTools.d.ts.map