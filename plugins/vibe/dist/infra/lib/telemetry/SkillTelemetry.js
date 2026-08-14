/**
 * SkillTelemetry — 스킬 사용 로컬 JSONL 로깅
 *
 * 모든 데이터는 로컬에만 저장됩니다.
 * 파일: ~/.vibe/analytics/skill-usage.jsonl
 *
 * 원격 전송 기능 없음 — 프라이버시 우선.
 */
import fs from 'fs';
import path from 'path';
import { DecisionTracer } from '../DecisionTracer.js';
// ─── SkillTelemetry ───
export class SkillTelemetry {
    logPath;
    enabled;
    decisions;
    spanLogPath;
    constructor(analyticsDir, enabled = true) {
        this.logPath = path.join(analyticsDir, 'skill-usage.jsonl');
        this.enabled = enabled;
        this.decisions = new DecisionTracer(analyticsDir, enabled);
        this.spanLogPath = path.join(analyticsDir, 'spans.jsonl');
        if (enabled) {
            fs.mkdirSync(analyticsDir, { recursive: true });
        }
    }
    /** 스킬 실행 이벤트 기록 */
    log(event) {
        if (!this.enabled)
            return;
        const fullEvent = {
            v: 1,
            ts: new Date().toISOString(),
            os: process.platform,
            ...event,
        };
        try {
            fs.appendFileSync(this.logPath, JSON.stringify(fullEvent) + '\n');
        }
        catch {
            // Silent fail — telemetry should never break the tool
        }
    }
    /** 편의 메서드: 스킬 실행 성공 기록 */
    logSuccess(skill, durationS, vibeVersion) {
        this.log({
            event_type: 'skill_run',
            skill,
            duration_s: durationS,
            outcome: 'success',
            vibe_version: vibeVersion,
        });
    }
    /** 편의 메서드: 스킬 실행 실패 기록 */
    logError(skill, durationS, vibeVersion) {
        this.log({
            event_type: 'skill_run',
            skill,
            duration_s: durationS,
            outcome: 'error',
            vibe_version: vibeVersion,
        });
    }
    /** 전체 이벤트 읽기 */
    readAll() {
        if (!fs.existsSync(this.logPath))
            return [];
        try {
            const content = fs.readFileSync(this.logPath, 'utf-8');
            return content
                .trim()
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => JSON.parse(line));
        }
        catch {
            return [];
        }
    }
    /** 스킬별 사용 요약 */
    summarize() {
        const events = this.readAll();
        const map = new Map();
        for (const event of events) {
            if (event.event_type !== 'skill_run')
                continue;
            const existing = map.get(event.skill) ?? {
                count: 0, successCount: 0, errorCount: 0,
                totalDuration: 0, durationCount: 0, lastUsed: event.ts,
            };
            existing.count++;
            if (event.outcome === 'success')
                existing.successCount++;
            if (event.outcome === 'error')
                existing.errorCount++;
            if (event.duration_s !== null) {
                existing.totalDuration += event.duration_s;
                existing.durationCount++;
            }
            if (event.ts > existing.lastUsed)
                existing.lastUsed = event.ts;
            map.set(event.skill, existing);
        }
        return [...map.entries()]
            .map(([skill, data]) => ({
            skill,
            count: data.count,
            successCount: data.successCount,
            errorCount: data.errorCount,
            avgDurationS: data.durationCount > 0
                ? Math.round((data.totalDuration / data.durationCount) * 10) / 10
                : null,
            lastUsed: data.lastUsed,
        }))
            .sort((a, b) => b.count - a.count);
    }
    /** Record an AI decision alongside skill telemetry */
    logDecision(input) {
        return this.decisions.record(input);
    }
    /** Retrieve all recorded decisions */
    getDecisions() {
        return this.decisions.readAll();
    }
    /** Log a structured span (v2) */
    logSpan(span) {
        if (!this.enabled)
            return;
        try {
            fs.appendFileSync(this.spanLogPath, JSON.stringify(span) + '\n');
        }
        catch {
            // Silent fail
        }
    }
    /** Read all spans */
    readSpans() {
        if (!fs.existsSync(this.spanLogPath))
            return [];
        try {
            const content = fs.readFileSync(this.spanLogPath, 'utf-8');
            return content
                .trim()
                .split('\n')
                .filter(line => line.trim().length > 0)
                .flatMap(line => {
                try {
                    return [JSON.parse(line)];
                }
                catch {
                    return [];
                }
            });
        }
        catch {
            return [];
        }
    }
    /** Get span log file path */
    getSpanLogPath() {
        return this.spanLogPath;
    }
    /** 로그 파일 경로 */
    getLogPath() {
        return this.logPath;
    }
}
//# sourceMappingURL=SkillTelemetry.js.map