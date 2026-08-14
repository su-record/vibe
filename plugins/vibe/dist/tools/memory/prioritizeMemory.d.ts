import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const prioritizeMemoryDefinition: ToolDefinition;
export declare function prioritizeMemory(args: {
    currentTask: string;
    criticalDecisions?: string[];
    codeChanges?: string[];
    blockers?: string[];
    nextSteps?: string[];
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=prioritizeMemory.d.ts.map