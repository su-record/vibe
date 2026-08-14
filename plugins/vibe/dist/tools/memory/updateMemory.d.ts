import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const updateMemoryDefinition: ToolDefinition;
export declare function updateMemory(args: {
    key: string;
    value: string;
    append?: boolean;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=updateMemory.d.ts.map