/**
 * Agent module - Core agent runtime components
 *
 * Exports:
 * - AgentLoop: Main agent execution loop with message handling and tool execution
 * - HeadModelSelector: Automatic head model selection with circuit breaker
 * - ToolRegistry: Tool registration and validation system
 * - ToolExecutor: Tool execution engine with timeout and result handling
 * - ConversationState: Conversation history management with sliding window
 * - Types: All agent-related type definitions
 */

// Runtime classes
export { AgentLoop } from './AgentLoop.js';
export { HeadModelSelector } from './HeadModelSelector.js';
export { ToolRegistry } from './ToolRegistry.js';
export { ToolExecutor } from './ToolExecutor.js';
export { ConversationState } from './ConversationState.js';

// Types from AgentLoop
export type { AgentLoopDeps, OnProgressCallback } from './AgentLoop.js';

// Types from ToolRegistry
export type { ToolRegistrationInput } from './ToolRegistry.js';

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
