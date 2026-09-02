/**
 * 벤치 리포트 — 관측값과 분모를 함께 적고, 결론을 대신 내지 않는다.
 *
 * 이 파일이 지키는 규칙 하나: **비율·퍼센트·배수를 쓰지 않는다.** 게이트 통과도
 * "3/5 회" 로 적지 "60%" 로 적지 않는다. 분모가 5인 비율은 정밀해 보이지만 아무것도
 * 말하지 않으며, 한 번 문서에 들어가면 출처 없이 유통된다 (constitution §3.5).
 */
import type { BenchComparison } from './benchCompare.js';
export interface BenchReportInput {
    name: string;
    /** ISO-8601 */
    ranAt: string;
    comparison: BenchComparison;
}
export declare function formatBenchReport(input: BenchReportInput): string;
//# sourceMappingURL=benchReport.d.ts.map