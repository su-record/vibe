/**
 * Traceability Matrix - 요구사항 추적 매트릭스 자동 생성
 *
 * 매핑: REQ → SPEC → Feature → Test
 */
/** 추적 항목 */
export interface TraceItem {
    requirementId: string;
    requirementDesc: string;
    specSection?: string;
    specFile?: string;
    featureScenario?: string;
    featureFile?: string;
    testFile?: string;
    testName?: string;
    coverage: 'full' | 'partial' | 'none';
}
/** 추적 매트릭스 */
export interface TraceabilityMatrix {
    featureName: string;
    items: TraceItem[];
    summary: TraceSummary;
    generatedAt: string;
    status: 'ok' | 'empty';
    warnings: string[];
}
/** 추적 요약 */
export interface TraceSummary {
    totalRequirements: number;
    specCovered: number;
    featureCovered: number;
    testCovered: number;
    coveragePercent: number;
    uncoveredRequirements: string[];
    partialRequirements: string[];
}
/** 매트릭스 생성 옵션 */
export interface TraceMatrixOptions {
    specPath?: string;
    featurePath?: string;
    testPath?: string;
    projectPath?: string;
}
/**
 * 추적 매트릭스 생성 (메인 함수)
 */
export declare function generateTraceabilityMatrix(featureName: string, options?: TraceMatrixOptions): TraceabilityMatrix;
/**
 * 매트릭스를 Markdown 테이블로 출력
 */
export declare function formatMatrixAsMarkdown(matrix: TraceabilityMatrix): string;
/**
 * 매트릭스를 HTML로 출력
 */
export declare function formatMatrixAsHtml(matrix: TraceabilityMatrix): string;
//# sourceMappingURL=traceabilityMatrix.d.ts.map