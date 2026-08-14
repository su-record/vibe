import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
export declare const CODE_QUALITY_METRICS: {
    COMPLEXITY: {
        maxCyclomaticComplexity: number;
        maxCognitiveComplexity: number;
        maxFunctionLines: number;
        maxFileLines: number;
        maxNestingDepth: number;
        maxParameters: number;
    };
    COUPLING: {
        maxDependencies: number;
        maxFanOut: number;
        preventCircularDeps: boolean;
    };
    COHESION: {
        singleResponsibility: boolean;
        relatedFunctionsOnly: boolean;
    };
    MAINTAINABILITY: {
        noMagicNumbers: boolean;
        consistentNaming: boolean;
        properErrorHandling: boolean;
        typesSafety: boolean;
    };
    PERFORMANCE: {
        memoizeExpensiveCalc: boolean;
        lazyLoading: boolean;
        batchOperations: boolean;
    };
};
export declare const validateCodeQualityDefinition: ToolDefinition;
export declare function validateCodeQuality(args: {
    code?: string;
    type?: string;
    strict?: boolean;
    metrics?: string;
    targetPath?: string;
    projectPath?: string;
}): Promise<ToolResult>;
//# sourceMappingURL=validateCodeQuality.d.ts.map