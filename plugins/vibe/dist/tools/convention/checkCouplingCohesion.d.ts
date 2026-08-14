import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const checkCouplingCohesionDefinition: ToolDefinition;
export declare function checkCouplingCohesion(args: {
    code: string;
    type?: string;
    checkDependencies?: boolean;
}): Promise<ToolResult>;
//# sourceMappingURL=checkCouplingCohesion.d.ts.map