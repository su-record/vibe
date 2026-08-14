import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { GoalStatus } from '../../infra/lib/memory/SessionRAGStore.js';
export declare const manageGoalsDefinition: ToolDefinition;
export declare function manageGoals(args: {
    action: 'list' | 'update' | 'complete';
    goalId?: number;
    progressPercent?: number;
    status?: GoalStatus;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=manageGoals.d.ts.map