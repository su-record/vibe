/**
 * Orchestrator Types - Agent SDK 기반 오케스트레이션 타입 정의
 */

import { ToolResult } from '../types/tool.js';

// Agent 관련 타입
export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  model?: 'claude-sonnet-4-5' | 'claude-opus-4' | 'claude-haiku-3-5';
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
}

// Background Agent 관련 타입
export interface BackgroundAgentArgs {
  prompt: string;
  agentName?: string;
  model?: 'claude-sonnet-4-5' | 'claude-opus-4' | 'claude-haiku-3-5';
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
