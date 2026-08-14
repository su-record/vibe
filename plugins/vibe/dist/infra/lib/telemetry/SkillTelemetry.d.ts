/**
 * SkillTelemetry — 스킬 사용 로컬 JSONL 로깅
 *
 * 모든 데이터는 로컬에만 저장됩니다.
 * 파일: ~/.vibe/analytics/skill-usage.jsonl
 *
 * 원격 전송 기능 없음 — 프라이버시 우선.
 */
import { DecisionTracer, DecisionInput, DecisionRecord } from '../DecisionTracer.js';
import type { VibeSpan } from './VibeSpan.js';
export interface SkillEvent {
    /** Schema version */
    v: 1;
    /** ISO 8601 timestamp */
    ts: string;
    /** Event type */
    event_type: 'skill_run' | 'skill_error' | 'hook_fire';
    /** Skill name */
    skill: string;
    /** Duration in seconds (null if not applicable) */
    duration_s: number | null;
    /** Outcome */
    outcome: 'success' | 'error' | 'abort';
    /** Vibe version */
    vibe_version: string;
    /** OS platform */
    os: string;
}
export interface SkillSummary {
    skill: string;
    count: number;
    successCount: number;
    errorCount: number;
    avgDurationS: number | null;
    lastUsed: string;
}
export declare class SkillTelemetry {
    private readonly logPath;
    private readonly enabled;
    readonly decisions: DecisionTracer;
    private readonly spanLogPath;
    constructor(analyticsDir: string, enabled?: boolean);
    /** 스킬 실행 이벤트 기록 */
    log(event: Omit<SkillEvent, 'v' | 'ts' | 'os'>): void;
    /** 편의 메서드: 스킬 실행 성공 기록 */
    logSuccess(skill: string, durationS: number | null, vibeVersion: string): void;
    /** 편의 메서드: 스킬 실행 실패 기록 */
    logError(skill: string, durationS: number | null, vibeVersion: string): void;
    /** 전체 이벤트 읽기 */
    readAll(): SkillEvent[];
    /** 스킬별 사용 요약 */
    summarize(): SkillSummary[];
    /** Record an AI decision alongside skill telemetry */
    logDecision(input: DecisionInput): DecisionRecord;
    /** Retrieve all recorded decisions */
    getDecisions(): DecisionRecord[];
    /** Log a structured span (v2) */
    logSpan(span: VibeSpan): void;
    /** Read all spans */
    readSpans(): VibeSpan[];
    /** Get span log file path */
    getSpanLogPath(): string;
    /** 로그 파일 경로 */
    getLogPath(): string;
}
//# sourceMappingURL=SkillTelemetry.d.ts.map