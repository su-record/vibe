import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const previewUiAsciiDefinition: ToolDefinition;
export declare function previewUiAscii(args: {
    page_name: string;
    layout_type?: string;
    components: Array<{
        type: string;
        label?: string;
        position?: string;
    }>;
    width?: number;
    responsive?: boolean;
}): Promise<ToolResult>;
//# sourceMappingURL=previewUiAscii.d.ts.map