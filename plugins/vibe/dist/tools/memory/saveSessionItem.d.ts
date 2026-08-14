import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const saveSessionItemDefinition: ToolDefinition;
export declare function saveSessionItem(args: {
    itemType: 'decision' | 'constraint' | 'goal' | 'evidence';
    title: string;
    description?: string;
    rationale?: string;
    alternatives?: string[];
    impact?: string;
    priority?: number;
    tags?: string[];
    relatedFiles?: string[];
    type?: 'technical' | 'business' | 'resource' | 'quality';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    scope?: string;
    progressPercent?: number;
    successCriteria?: string[];
    parentId?: number;
    evidenceType?: 'test' | 'build' | 'lint' | 'coverage' | 'hud' | 'review';
    status?: 'pass' | 'fail' | 'warning' | 'info';
    metrics?: Record<string, unknown>;
    relatedGoals?: number[];
    sessionId?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=saveSessionItem.d.ts.map