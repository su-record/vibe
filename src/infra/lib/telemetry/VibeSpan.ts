/**
 * VibeSpan — Structured telemetry spans
 * Inspired by Agent-Lightning's semantic span conventions.
 */

import crypto from 'crypto';

export type SpanType =
  | 'skill_run'
  | 'agent_run'
  | 'edit'
  | 'build'
  | 'review'
  | 'hook'
  | 'llm_call'
  | 'decision';

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

export function createSpan(
  type: SpanType,
  name: string,
  attributes?: Record<string, string | number | boolean>,
  parentId?: string,
): VibeSpan {
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

export function completeSpan(
  span: VibeSpan,
  status: SpanStatus,
  durationMs: number,
): VibeSpan {
  return {
    ...span,
    status,
    duration_ms: durationMs,
  };
}
