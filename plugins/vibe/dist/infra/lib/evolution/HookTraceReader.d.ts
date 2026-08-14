export interface HookTrace {
    ts: string;
    hook: string;
    tool: string;
    decision: 'allow' | 'block' | 'warn';
    reason: string;
    project: string;
}
export interface TraceCluster {
    /** 대표 사유 패턴 */
    pattern: string;
    /** 훅 이름 */
    hook: string;
    /** 판정 유형 */
    decision: 'block' | 'warn';
    /** 발생 횟수 */
    count: number;
    /** 대상 도구 목록 */
    tools: string[];
    /** 최초 발생 */
    firstSeen: string;
    /** 최종 발생 */
    lastSeen: string;
}
export interface TraceStats {
    totalTraces: number;
    blockCount: number;
    warnCount: number;
    byHook: Record<string, number>;
    byTool: Record<string, number>;
    clusters: TraceCluster[];
}
/**
 * JSONL 파일에서 최근 N일간 trace 항목 읽기
 */
export declare function readTraces(daysBack?: number): HookTrace[];
/**
 * Trace 목록을 패턴별로 클러스터링
 */
export declare function clusterTraces(traces: HookTrace[]): TraceCluster[];
/**
 * 전체 통계 + 클러스터 분석 수행
 */
export declare function analyzeTraces(daysBack?: number): TraceStats;
//# sourceMappingURL=HookTraceReader.d.ts.map