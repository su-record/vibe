import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const analyzeComplexityDefinition: ToolDefinition;
export declare function analyzeComplexity(args: {
    code?: string;
    metrics?: string;
    targetPath?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=analyzeComplexity.d.ts.map