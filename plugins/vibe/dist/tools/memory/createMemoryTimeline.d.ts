import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const createMemoryTimelineDefinition: ToolDefinition;
interface CreateMemoryTimelineArgs {
    startDate?: string;
    endDate?: string;
    category?: string;
    limit?: number;
    groupBy?: 'day' | 'week' | 'month' | 'category';
    projectPath?: string;
}
export declare function createMemoryTimeline(args: CreateMemoryTimelineArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=createMemoryTimeline.d.ts.map