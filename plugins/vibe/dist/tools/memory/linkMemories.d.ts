import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const linkMemoriesDefinition: ToolDefinition;
interface LinkMemoriesArgs {
    sourceKey: string;
    targetKey: string;
    relationType: string;
    strength?: number;
    bidirectional?: boolean;
    projectPath?: string;
}
export declare function linkMemories(args: LinkMemoriesArgs): Promise<ToolResult>;
export {};
//# sourceMappingURL=linkMemories.d.ts.map