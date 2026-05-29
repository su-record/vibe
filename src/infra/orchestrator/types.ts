/**
 * Orchestrator Types - Agent SDK 기반 오케스트레이션 타입 정의
 */

import { ToolResult } from '../types/tool.js';
import { detectLlmAvailability } from '../lib/llm-availability.js';

// 모델 타입 정의
export type ClaudeModel =
  | 'claude-sonnet-4-5'
  | 'claude-opus-4'
  | 'claude-haiku-3-5'
  | 'claude-haiku-4-5-20251001'
  | string; // 새 모델 호환성

// Agent 관련 타입
export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  model?: ClaudeModel;
  maxTurns?: number;
  allowedTools?: string[];
  systemPrompt?: string;
}

export interface AgentResult {
  agentName: string;
  sessionId: string;
  result: string;
  success: boolean;
  error?: string;
  duration: number;
}

// Parallel Research 관련 타입
export interface ResearchTask {
  name: string;
  prompt: string;
  category: 'best-practices' | 'framework-docs' | 'codebase-patterns' | 'security-advisory' | 'custom';
}

export interface ParallelResearchArgs {
  tasks: ResearchTask[];
  projectPath?: string;
  maxConcurrency?: number;
  timeout?: number;
}

export interface ParallelResearchResult {
  results: AgentResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
  /** Multi-LLM 리서치 결과 */
  multiLlm?: MultiLlmResearchResult;
}

/** Multi-LLM 단일 결과 */
export interface MultiLlmResult {
  provider: 'gpt' | 'antigravity';
  category: 'best-practices' | 'security';
  result: string;
  success: boolean;
  error?: string;
  duration: number;
}

/** Multi-LLM 리서치 전체 결과 */
export interface MultiLlmResearchResult {
  results: MultiLlmResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

// Background Agent 관련 타입
export interface BackgroundAgentArgs {
  prompt: string;
  agentName?: string;
  model?: ClaudeModel;
  maxTurns?: number;
  allowedTools?: string[];
  projectPath?: string;
  onProgress?: (message: string) => void;
}

export interface BackgroundAgentHandle {
  sessionId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  getResult: () => Promise<AgentResult>;
  cancel: () => void;
}

// Agent Discovery 관련 타입
export interface DiscoveredAgent {
  name: string;
  path: string;
  category: string;
  description: string;
  content: string;
}

export interface AgentDiscoveryArgs {
  projectPath?: string;
  category?: string;
  pattern?: string;
}

// Session 관리 타입
export interface SessionInfo {
  sessionId: string;
  agentName: string;
  status: 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  prompt: string;
}

export interface SessionStore {
  sessions: Map<string, SessionInfo>;
  add: (session: SessionInfo) => void;
  get: (sessionId: string) => SessionInfo | undefined;
  list: () => SessionInfo[];
  cleanup: (maxAge: number) => void;
}

// Orchestrator 옵션
export interface OrchestratorOptions {
  projectPath?: string;
  verbose?: boolean;
  saveResults?: boolean;
  resultsPath?: string;
}

// Message 타입 (Agent SDK 호환)
export interface AgentMessage {
  type: 'system' | 'assistant' | 'user' | 'result';
  subtype?: 'init' | 'progress' | 'tool_use' | 'tool_result';
  session_id?: string;
  content?: string;
  result?: string;
  message?: {
    content: Array<{ type: string; text?: string }>;
  };
}

// Tool Result 확장
export interface OrchestratorToolResult extends ToolResult {
  metadata?: {
    sessionId?: string;
    duration?: number;
    agentName?: string;
  };
}

// ============================================
// Smart Routing Types
// ============================================

/** 작업 유형 - LLM 선택에 사용 */
export type TaskType =
  | 'architecture'
  | 'debugging'
  | 'uiux'
  | 'code-analysis'
  | 'code-gen'
  | 'web-search'
  | 'general'
  | 'code-review'
  | 'reasoning';

/** LLM 제공자 */
export type LLMProvider = 'gpt' | 'antigravity' | 'claude';

/** 스마트 라우팅 요청 */
export interface SmartRouteRequest {
  type: TaskType;
  prompt: string;
  systemPrompt?: string;
  /** 특정 LLM 강제 지정 (fallback은 여전히 동작) */
  preferredLlm?: LLMProvider;
  /** 재시도 횟수 (기본: 2) */
  maxRetries?: number;
}

/** 스마트 라우팅 결과 */
export interface SmartRouteResult {
  content: string;
  provider: LLMProvider;
  success: boolean;
  /** fallback 발생 여부 */
  usedFallback: boolean;
  /** 시도한 LLM 목록 */
  attemptedProviders: LLMProvider[];
  /** 각 LLM의 에러 (있는 경우) */
  errors?: Record<LLMProvider, string>;
  duration: number;
}

/** LLM 가용성 캐시 */
export interface LLMAvailabilityCache {
  gpt: { available: boolean; checkedAt: number; errorCount: number };
  antigravity: { available: boolean; checkedAt: number; errorCount: number };
}

/**
 * 작업 유형별 LLM 우선순위
 * - GPT/Antigravity → Claude (fallback)
 * - Antigravity: UI/UX, 웹 검색
 */
export const TASK_LLM_PRIORITY: Record<TaskType, LLMProvider[]> = {
  'architecture': ['gpt', 'antigravity', 'claude'],
  'debugging': ['gpt', 'antigravity', 'claude'],
  'uiux': ['antigravity', 'gpt', 'claude'],
  'code-analysis': ['gpt', 'antigravity', 'claude'],
  'code-gen': ['gpt', 'claude'],
  'web-search': ['antigravity', 'gpt', 'claude'],
  'general': ['gpt', 'claude'],
  'code-review': ['gpt', 'antigravity', 'claude'],
  'reasoning': ['gpt', 'antigravity', 'claude'],
};

/**
 * 동적 LLM 우선순위 — Codex/Antigravity 활성화 상태에 따라 자동 조정
 *
 * 기본: Claude만 사용
 * +Codex: 추론/코딩/리뷰에 GPT 추가
 * +Antigravity: 리서치/리뷰/UI에 Antigravity 추가
 */
export function getTaskLlmPriority(type: TaskType): LLMProvider[] {
  const { codex, antigravity } = detectLlmAvailability();

  // 둘 다 비활성화 → Claude only
  if (!codex && !antigravity) {
    return ['claude'];
  }

  // 기본 Claude 베이스
  const priority: LLMProvider[] = [];

  if (codex) {
    // GPT 우선 작업 유형
    if (['architecture', 'reasoning', 'code-analysis', 'code-gen', 'debugging', 'code-review'].includes(type)) {
      priority.push('gpt');
    }
  }

  if (antigravity) {
    // Antigravity 우선 작업 유형
    if (['web-search', 'uiux'].includes(type)) {
      priority.unshift('antigravity');
    } else if (['code-review', 'architecture', 'reasoning'].includes(type)) {
      // 교차 검증용 — GPT 뒤에
      priority.push('antigravity');
    }
  }

  // Claude는 항상 fallback
  priority.push('claude');

  return priority;
}
