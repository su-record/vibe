import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const saveMemoryDefinition: ToolDefinition;
export declare function saveMemory(args: {
    key: string;
    value: string;
    category?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=saveMemory.d.ts.map