// HookTraceReader — JSONL hook trace 파일 읽기 및 집계
// Guard hooks가 ~/.vibe/hook-traces.jsonl에 기록한 로그를 읽고 분석

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

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

const TRACE_FILENAME = 'hook-traces.jsonl';
const MIN_CLUSTER_SIZE = 3;

/**
 * hook-traces.jsonl 파일 경로 반환
 */
function getTracePath(): string {
  const home = os.homedir();
  return path.join(home, '.vibe', TRACE_FILENAME);
}

/**
 * JSONL 파일에서 최근 N일간 trace 항목 읽기
 */
export function readTraces(daysBack: number = 7): HookTrace[] {
  const tracePath = getTracePath();
  if (!existsSync(tracePath)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffIso = cutoff.toISOString();

  const raw = readFileSync(tracePath, 'utf-8');
  const traces: HookTrace[] = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as HookTrace;
      if (entry.ts >= cutoffIso) {
        traces.push(entry);
      }
    } catch {
      // 깨진 줄 무시
    }
  }

  return traces;
}

/**
 * 사유 문자열을 정규화 (파일 경로, 명령어 세부 사항 제거)
 */
function normalizeReason(reason: string): string {
  return reason
    .replace(/\/[\w/._-]+/g, '<path>')
    .replace(/`[^`]+`/g, '<cmd>')
    .replace(/:\s+.*$/, '')
    .trim();
}

/**
 * Trace 목록을 패턴별로 클러스터링
 */
export function clusterTraces(traces: HookTrace[]): TraceCluster[] {
  const actionable = traces.filter(t => t.decision !== 'allow');
  const groups = new Map<string, HookTrace[]>();

  for (const trace of actionable) {
    const key = `${trace.hook}:${normalizeReason(trace.reason)}`;
    const group = groups.get(key) ?? [];
    group.push(trace);
    groups.set(key, group);
  }

  const clusters: TraceCluster[] = [];
  for (const [, group] of groups) {
    if (group.length < MIN_CLUSTER_SIZE) continue;

    const sorted = group.sort((a, b) => a.ts.localeCompare(b.ts));
    const tools = [...new Set(group.map(t => t.tool))];

    clusters.push({
      pattern: normalizeReason(group[0].reason),
      hook: group[0].hook,
      decision: group[0].decision as 'block' | 'warn',
      count: group.length,
      tools,
      firstSeen: sorted[0].ts,
      lastSeen: sorted[sorted.length - 1].ts,
    });
  }

  return clusters.sort((a, b) => b.count - a.count);
}

/**
 * 전체 통계 + 클러스터 분석 수행
 */
export function analyzeTraces(daysBack: number = 7): TraceStats {
  const traces = readTraces(daysBack);
  const byHook: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  let blockCount = 0;
  let warnCount = 0;

  for (const t of traces) {
    byHook[t.hook] = (byHook[t.hook] ?? 0) + 1;
    byTool[t.tool] = (byTool[t.tool] ?? 0) + 1;
    if (t.decision === 'block') blockCount++;
    if (t.decision === 'warn') warnCount++;
  }

  return {
    totalTraces: traces.length,
    blockCount,
    warnCount,
    byHook,
    byTool,
    clusters: clusterTraces(traces),
  };
}
