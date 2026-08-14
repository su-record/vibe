import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const suggestImprovementsDefinition: ToolDefinition;
export declare function suggestImprovements(args: {
    code: string;
    focus?: string;
    priority?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=suggestImprovements.d.ts.map