/**
 * Orchestrator Types - Agent SDK 기반 오케스트레이션 타입 정의
 */

import { ToolResult } from '../types/tool.js';
import { detectLlmAvailability } from '../lib/llm-availability.js';

// 모델 타입 정의 — 현행 모델 ID (레거시 별칭은 아래 tier alias 로 흡수)
// 네이밍 규약: date-suffix 없는 short id 로 통일 (lib/constants.ts MODEL_LIMITS 키와 동일)
export type ClaudeModel =
  | 'claude-opus-4-8'
  | 'claude-sonnet-5'
  | 'claude-haiku-4-5'
  // tier alias — Claude Code Task(model:) / frontmatter 에서 그대로 쓰인다
  | 'opus'
  | 'sonnet'
  | 'haiku'
  | 'inherit'
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
export type LLMProvider = 'gpt' | 'antigravity' | 'zai' | 'claude';

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
  zai: { available: boolean; checkedAt: number; errorCount: number };
}

/**
 * 작업 유형 목록 (런타임 SSOT — TaskType 유니온의 값 표현)
 */
export const TASK_TYPES: TaskType[] = [
  'architecture', 'debugging', 'uiux', 'code-analysis', 'code-gen',
  'web-search', 'general', 'code-review', 'reasoning',
];

// ─── LLM 라우팅 정책 (단일 SSOT) ───
// 아래 그룹 + computeLlmPriority 가 provider 우선순위의 유일 소스다.
// 정적 맵(TASK_LLM_PRIORITY)과 동적 함수(getTaskLlmPriority) 둘 다 여기서 파생하므로
// 구조적으로 어긋날 수 없다. (이전에는 두 정의가 서로 다른 정책을 인코딩해 드리프트했다)

/** Codex(GPT) 를 우선 붙이는 작업 유형 */
const GPT_TASK_TYPES: readonly TaskType[] = [
  'architecture', 'reasoning', 'code-analysis', 'code-gen', 'debugging', 'code-review',
];
/** Antigravity 를 최우선(맨 앞)으로 두는 작업 유형 */
const ANTIGRAVITY_FIRST_TASK_TYPES: readonly TaskType[] = ['web-search', 'uiux'];
/** Antigravity 를 교차검증용(GPT 뒤)으로 붙이는 작업 유형 */
const ANTIGRAVITY_CROSSCHECK_TASK_TYPES: readonly TaskType[] = ['code-review', 'architecture', 'reasoning'];
/**
 * ZAI(GLM 최고 모델)가 최우선으로 담당하는 UI 작업 유형.
 * "zai 사용 가능 시 모든 UI 개발은 GLM 최고 모델이 담당" 정책.
 */
const ZAI_UI_TASK_TYPES: readonly TaskType[] = ['uiux'];

/** LLM 가용성 입력 — provider 별 boolean (미지정은 비가용으로 취급) */
export interface LlmAvailabilityInput {
  codex?: boolean;
  antigravity?: boolean;
  zai?: boolean;
}

/**
 * 순수 LLM 우선순위 정책 — 가용성만 입력받아 provider 체인을 계산한다(I/O 없음).
 * Claude 는 항상 최후 fallback.
 */
export function computeLlmPriority(
  type: TaskType,
  availability: LlmAvailabilityInput
): LLMProvider[] {
  const { codex, antigravity, zai } = availability;
  if (!codex && !antigravity && !zai) return ['claude'];

  const priority: LLMProvider[] = [];
  // ZAI(GLM)가 가용하면 UI 작업을 최우선으로 담당
  if (zai && ZAI_UI_TASK_TYPES.includes(type)) priority.push('zai');

  if (codex && GPT_TASK_TYPES.includes(type)) priority.push('gpt');
  if (antigravity) {
    if (ANTIGRAVITY_FIRST_TASK_TYPES.includes(type)) {
      // zai 가 이미 선두면 그 뒤로, 아니면 맨 앞으로
      if (priority[0] === 'zai') priority.push('antigravity');
      else priority.unshift('antigravity');
    } else if (ANTIGRAVITY_CROSSCHECK_TASK_TYPES.includes(type)) {
      priority.push('antigravity');
    }
  }
  priority.push('claude');
  return priority;
}

/**
 * 작업 유형별 LLM 우선순위 (모든 provider 가용 시의 이상적 순서).
 * computeLlmPriority 에서 파생 — getTaskLlmPriority(런타임) 와 절대 어긋나지 않는다.
 */
export const TASK_LLM_PRIORITY: Record<TaskType, LLMProvider[]> = Object.fromEntries(
  TASK_TYPES.map((t) => [t, computeLlmPriority(t, { codex: true, antigravity: true, zai: true })])
) as Record<TaskType, LLMProvider[]>;

/**
 * 작업 유형별 기본 system prompt (SSOT)
 * — SmartRouter 편의 메서드와 index.ts smart* 래퍼가 공유한다.
 *   (이전에는 두 계층에 같은 문자열이 각각 하드코딩되어 있었다)
 */
export const TASK_SYSTEM_PROMPTS: Record<TaskType, string> = {
  'architecture': 'You are a software architect. Analyze and review the architecture.',
  'debugging': 'You are a debugging expert. Find bugs and suggest fixes.',
  'uiux': 'You are a UI/UX expert. Analyze and provide feedback.',
  'code-analysis': 'You are a code analysis expert. Review and analyze the code.',
  'code-gen': 'Generate clean, well-documented code.',
  'web-search': 'Search the web and provide relevant information.',
  'general': 'You are a helpful assistant.',
  'code-review': 'You are a code review expert. Review the code for bugs, style, and best practices.',
  'reasoning': 'You are a reasoning expert. Analyze the problem step by step.',
};

/**
 * 동적 LLM 우선순위 — 런타임 Codex/Antigravity 가용성에 맞춰 computeLlmPriority 를 적용.
 *
 * 기본: Claude만 사용 · +Codex: 추론/코딩/리뷰에 GPT 추가 · +Antigravity: 리서치/리뷰/UI에 추가
 */
export function getTaskLlmPriority(type: TaskType): LLMProvider[] {
  return computeLlmPriority(type, detectLlmAvailability());
}
