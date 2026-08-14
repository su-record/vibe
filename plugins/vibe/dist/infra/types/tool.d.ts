export interface ToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    [key: string]: unknown;
}
export interface ToolAnnotation {
    audience?: string[];
    title?: string;
    progress?: number;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}
export interface JsonSchemaProperty {
    type?: string;
    description?: string;
    enum?: unknown[];
    default?: unknown;
    [key: string]: unknown;
}
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, JsonSchemaProperty>;
        required?: string[];
    };
    annotations?: ToolAnnotation;
}
export interface MemoryRelation {
    sourceKey: string;
    targetKey: string;
    relationType: string;
    strength: number;
    metadata?: Record<string, unknown>;
    timestamp: string;
}
export interface MemoryGraphNode {
    key: string;
    value: string;
    category: string;
    relations: MemoryRelation[];
}
export interface MemoryGraph {
    nodes: MemoryGraphNode[];
    edges: MemoryRelation[];
    clusters: string[][];
}
export type SearchStrategy = 'keyword' | 'fulltext' | 'graph_traversal' | 'temporal' | 'priority' | 'context_aware';
export interface ToolUsage {
    toolName: string;
    timestamp: string;
    duration: number;
    success: boolean;
    errorMessage?: string;
}
export interface UsageStats {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    topTools: Array<{
        name: string;
        count: number;
    }>;
    errorsByTool: Record<string, number>;
}
//# sourceMappingURL=tool.d.ts.map