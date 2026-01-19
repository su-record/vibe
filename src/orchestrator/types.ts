/**
 * Orchestrator Types - Agent SDK 기반 오케스트레이션 타입 정의
 */

import { ToolResult } from '../types/tool.js';

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
  /** Multi-LLM 리서치 결과 (v2.5.0) */
  multiLlm?: MultiLlmResearchResult;
}

/** Multi-LLM 단일 결과 (v2.5.0) */
export interface MultiLlmResult {
  provider: 'gpt' | 'gemini';
  category: 'best-practices' | 'security';
  result: string;
  success: boolean;
  error?: string;
  duration: number;
}

/** Multi-LLM 리서치 전체 결과 (v2.5.0) */
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
  | 'architecture'    // 아키텍처 분석/리뷰 → GPT 우선
  | 'debugging'       // 디버깅 → GPT 우선
  | 'uiux'           // UI/UX 분석 → Gemini 우선
  | 'code-analysis'  // 코드 분석 → Gemini 우선
  | 'code-gen'       // 코드 생성 → Claude 직접
  | 'web-search'     // 웹 검색 → GPT/Gemini
  | 'general';       // 일반 → Claude 직접

/** LLM 제공자 */
export type LLMProvider = 'gpt' | 'gemini' | 'claude';

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
  gemini: { available: boolean; checkedAt: number; errorCount: number };
}

/** 작업 유형별 LLM 우선순위 */
export const TASK_LLM_PRIORITY: Record<TaskType, LLMProvider[]> = {
  'architecture': ['gpt', 'gemini', 'claude'],
  'debugging': ['gpt', 'gemini', 'claude'],
  'uiux': ['gemini', 'gpt', 'claude'],
  'code-analysis': ['gemini', 'gpt', 'claude'],
  'code-gen': ['claude'],
  'web-search': ['gpt', 'gemini', 'claude'],
  'general': ['claude']
};
