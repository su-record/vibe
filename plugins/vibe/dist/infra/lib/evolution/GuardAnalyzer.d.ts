import { InsightStore } from './InsightStore.js';
import { TraceStats } from './HookTraceReader.js';
export interface GuardAnalysisResult {
    newInsights: string[];
    mergedInsights: string[];
    stats: TraceStats;
}
export declare class GuardAnalyzer {
    private insightStore;
    constructor(insightStore: InsightStore);
    /**
     * 최근 hook trace 분석 → insight 생성
     */
    analyze(daysBack?: number): GuardAnalysisResult;
    /**
     * 개별 클러스터를 인사이트로 변환
     */
    private processCluster;
    /**
     * 클러스터 유형 분류
     */
    private classifyCluster;
    /**
     * 인사이트 제목 생성
     */
    private buildTitle;
    /**
     * 인사이트 설명 생성
     */
    private buildDescription;
    /**
     * 두 ISO 문자열 사이 일수 계산
     */
    private daysBetween;
    /**
     * confidence 점수 계산 (빈도 + 기간 기반)
     */
    private calculateConfidence;
    /**
     * 태그 생성
     */
    private buildTags;
}
//# sourceMappingURL=GuardAnalyzer.d.ts.map