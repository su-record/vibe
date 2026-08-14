/**
 * VibeSpan — Structured telemetry spans
 * Inspired by Agent-Lightning's semantic span conventions.
 */
export type SpanType = 'skill_run' | 'agent_run' | 'edit' | 'build' | 'review' | 'hook' | 'llm_call' | 'decision';
export type SpanStatus = 'ok' | 'error' | 'abort';
export interface VibeSpan {
    v: 2;
    id: string;
    ts: string;
    type: SpanType;
    name: string;
    duration_ms: number | null;
    status: SpanStatus;
    attributes: Record<string, string | number | boolean>;
    parent_id?: string;
}
export declare function createSpan(type: SpanType, name: string, attributes?: Record<string, string | number | boolean>, parentId?: string): VibeSpan;
export declare function completeSpan(span: VibeSpan, status: SpanStatus, durationMs: number): VibeSpan;
//# sourceMappingURL=VibeSpan.d.ts.map