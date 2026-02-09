/**
 * Agent module - Core agent runtime components
 *
 * Exports:
 * - AgentLoop: Main agent execution loop with message handling and tool execution
 * - HeadModelSelector: Automatic head model selection with circuit breaker
 * - ToolExecutor: Tool execution engine with timeout and result handling
 * - ConversationState: Conversation history management with sliding window
 * - ConversationStore: SQLite-based persistent conversation history storage
 * - Types: All agent-related type definitions
 */

// Runtime classes
export { AgentLoop } from './AgentLoop.js';
export { HeadModelSelector } from './HeadModelSelector.js';
export { ToolExecutor } from './ToolExecutor.js';
export { ConversationState } from './ConversationState.js';
export { ConversationStore } from './ConversationStore.js';

// Types from AgentLoop
export type { AgentLoopDeps, OnProgressCallback } from './AgentLoop.js';

// Core types from types.ts
export type {
  AgentMessage,
  HeadModelProvider,
  HeadModelResponse,
  ToolCall,
  AgentProgressEvent,
  AgentProgressEventType,
  AgentProgressData,
  ToolScope,
  HeadModelProviderType,
  AgentToolDefinition,
  ToolDefinition,
  RegisteredTool,
  ToolCallResult,
  HeadModelConfig,
  JsonSchema,
  OpenAITool,
  AnthropicTool,
  CircuitBreakerState,
  ToolExecutionResult,
  ToolAuditEntry,
  ConversationSession,
} from './types.js';
