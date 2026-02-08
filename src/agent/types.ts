/**
 * Agent Core Types
 * Phase 1: Head Model Selection & Tool Registry
 */

import type { z } from 'zod';

// === Provider Types ===

export type HeadModelProviderType = 'gpt' | 'claude';

export type ToolScope = 'read' | 'write' | 'execute';

// === Tool Call Types ===

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  toolCallId: string;
  content: string;
}

// === Message Types ===

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

// === Configuration ===

export interface HeadModelConfig {
  provider: HeadModelProviderType;
  model: string;
  temperature: number;
  maxTokens: number;
}

// === Response ===

export interface HeadModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
  model: string;
}

// === Provider Interface ===

export interface HeadModelProvider {
  readonly provider: HeadModelProviderType;
  readonly model: string;
  chat(
    messages: AgentMessage[],
    tools?: AgentToolDefinition[],
  ): Promise<HeadModelResponse>;
}

// === JSON Schema (tool parameter definition) ===

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
  const?: unknown;
  oneOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

// === Tool Schema Types ===

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
  scope: ToolScope;
}

export interface RegisteredTool {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: Record<string, unknown>) => Promise<string>;
  scope: ToolScope;
}

// === Provider-Specific Formats ===

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

// === Circuit Breaker ===

export interface CircuitBreakerState {
  failureCount: number;
  lastFailure: number;
  isOpen: boolean;
  halfOpenAttempted: boolean;
}

// === Phase 2: Agent Core Loop Types ===

export interface ToolExecutionResult {
  status: 'success' | 'error' | 'timeout';
  content: string;
  latencyMs: number;
  toolName: string;
}

export interface ToolAuditEntry {
  timestamp: string;
  toolName: string;
  args: Record<string, unknown>;
  latencyMs: number;
  success: boolean;
  errorType?: string;
}

export interface ConversationSession {
  chatId: string;
  messages: AgentMessage[];
  lastActivity: number;
}
