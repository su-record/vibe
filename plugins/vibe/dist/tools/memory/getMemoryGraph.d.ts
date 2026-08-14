import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const getMemoryGraphDefinition: ToolDefinition;
interface GetMemoryGraphArgs {
    key?: string;
    depth?: number;
    relationType?: string;
    format?: 'tree' | 'list' | 'mermaid';
    projectPath?: string;
}
export declare function getMemoryGraph(args: GetMemoryGraphArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=getMemoryGraph.d.ts.map