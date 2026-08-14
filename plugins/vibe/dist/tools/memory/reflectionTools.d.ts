import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const reflectNowDefinition: ToolDefinition;
interface ReflectNowArgs {
    insights?: string[];
    decisions?: string[];
    patterns?: string[];
    filesContext?: string[];
    score?: number;
    sessionId?: string;
    projectPath?: string;
}
export declare function reflectNow(args: ReflectNowArgs): Promise<ToolResult>;
export declare const searchReflectionsDefinition: ToolDefinition;
interface SearchReflectionsArgs {
    query: string;
    limit?: number;
    projectPath?: string;
}
export declare function searchReflections(args: SearchReflectionsArgs): Promise<ToolResult>;
export declare const getSessionReflectionsDefinition: ToolDefinition;
interface GetSessionReflectionsArgs {
    sessionId: string;
    projectPath?: string;
}
export declare function getSessionReflections(args: GetSessionReflectionsArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=reflectionTools.d.ts.map