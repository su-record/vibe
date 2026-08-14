/**
 * VibeSpan — Structured telemetry spans
 * Inspired by Agent-Lightning's semantic span conventions.
 */
import crypto from 'crypto';
export function createSpan(type, name, attributes, parentId) {
    return {
        v: 2,
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        type,
        name,
        duration_ms: null,
        status: 'ok',
        attributes: attributes ?? {},
        parent_id: parentId,
    };
}
export function completeSpan(span, status, durationMs) {
    return {
        ...span,
        status,
        duration_ms: durationMs,
    };
}
//# sourceMappingURL=VibeSpan.js.map