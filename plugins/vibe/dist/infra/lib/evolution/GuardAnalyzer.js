// GuardAnalyzer — Hook trace 패턴 분석 → InsightStore에 인사이트 생성
// 하네스 자기 개선의 핵심 모듈: guard 실행 로그를 분석하여 하네스 규칙을 자동 튜닝
import { analyzeTraces } from './HookTraceReader.js';
const HIGH_FREQUENCY_THRESHOLD = 10;
const WARN_FREQUENCY_THRESHOLD = 20;
export class GuardAnalyzer {
    insightStore;
    constructor(insightStore) {
        this.insightStore = insightStore;
    }
    /**
     * 최근 hook trace 분석 → insight 생성
     */
    analyze(daysBack = 7) {
        const stats = analyzeTraces(daysBack);
        const result = {
            newInsights: [],
            mergedInsights: [],
            stats,
        };
        if (stats.clusters.length === 0)
            return result;
        for (const cluster of stats.clusters) {
            this.processCluster(cluster, result);
        }
        return result;
    }
    /**
     * 개별 클러스터를 인사이트로 변환
     */
    processCluster(cluster, result) {
        const title = this.buildTitle(cluster);
        const description = this.buildDescription(cluster);
        // 중복 체크 + 병합
        const existingId = this.insightStore.findAndMergeDuplicate(title, '');
        if (existingId) {
            result.mergedInsights.push(existingId);
            return;
        }
        const input = {
            type: this.classifyCluster(cluster),
            title,
            description,
            confidence: this.calculateConfidence(cluster),
            tags: this.buildTags(cluster),
            generatedFrom: 'agent_stats',
        };
        const id = this.insightStore.save(input);
        result.newInsights.push(id);
    }
    /**
     * 클러스터 유형 분류
     */
    classifyCluster(cluster) {
        // 높은 빈도의 block → 에이전트가 반복적으로 차단되는 패턴
        if (cluster.decision === 'block' && cluster.count >= HIGH_FREQUENCY_THRESHOLD) {
            return 'optimization';
        }
        // warn이 너무 자주 발생 → 노이즈 가능성
        if (cluster.decision === 'warn' && cluster.count >= WARN_FREQUENCY_THRESHOLD) {
            return 'anti_pattern';
        }
        return 'pattern';
    }
    /**
     * 인사이트 제목 생성
     */
    buildTitle(cluster) {
        const action = cluster.decision === 'block' ? 'Blocked' : 'Warned';
        return `Guard ${action}: ${cluster.pattern} (${cluster.count}x)`;
    }
    /**
     * 인사이트 설명 생성
     */
    buildDescription(cluster) {
        const tools = cluster.tools.join(', ');
        const span = this.daysBetween(cluster.firstSeen, cluster.lastSeen);
        return [
            `Hook: ${cluster.hook}`,
            `Decision: ${cluster.decision} (${cluster.count} times over ${span} days)`,
            `Affected tools: ${tools}`,
            `Pattern: ${cluster.pattern}`,
        ].join('; ');
    }
    /**
     * 두 ISO 문자열 사이 일수 계산
     */
    daysBetween(a, b) {
        const msPerDay = 86_400_000;
        const diff = new Date(b).getTime() - new Date(a).getTime();
        return Math.max(1, Math.round(diff / msPerDay));
    }
    /**
     * confidence 점수 계산 (빈도 + 기간 기반)
     */
    calculateConfidence(cluster) {
        const freqScore = Math.min(0.5, cluster.count * 0.05);
        const spanDays = this.daysBetween(cluster.firstSeen, cluster.lastSeen);
        const spanScore = Math.min(0.3, spanDays * 0.05);
        const decisionScore = cluster.decision === 'block' ? 0.2 : 0.1;
        return Math.min(1.0, freqScore + spanScore + decisionScore);
    }
    /**
     * 태그 생성
     */
    buildTags(cluster) {
        return [
            'guard',
            'harness',
            cluster.hook,
            cluster.decision,
            ...cluster.tools.map(t => t.toLowerCase()),
        ];
    }
}
//# sourceMappingURL=GuardAnalyzer.js.map