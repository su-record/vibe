import { uuidv7 } from 'uuidv7';
import type { TaskStep, StepType } from './TaskDecomposer.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_MESSAGE_BYTES = 10_240; // 10KB
const MAX_CONTEXT_ITEMS = 100;
const AGENT_TIMEOUT_MS = 600_000; // 10 minutes
const MAX_RETRIES = 1;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type MessageType = 'request' | 'response' | 'broadcast' | 'handoff';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: unknown;
  correlationId: string;
  timestamp: string;
}

export type AgentRole = 'planner' | 'implementer' | 'reviewer' | 'tester' | 'sentinel';

export interface AgentAssignment {
  stepId: string;
  role: AgentRole;
  agentName: string;
  assignedAt: string;
}

export interface HandoffContext {
  files: string[];
  changes: string[];
  decisions: string[];
  metadata?: Record<string, unknown>;
}

export interface HandoffResult {
  id: string;
  from: string;
  to: string;
  context: HandoffContext;
  success: boolean;
  timestamp: string;
}

export class MessageSizeError extends Error {
  constructor(size: number) {
    super(`Message exceeds 10KB limit: ${size} bytes`);
    this.name = 'MessageSizeError';
  }
}

export class AgentTimeoutError extends Error {
  constructor(agentName: string, stepId: string) {
    super(`Agent '${agentName}' timed out on step '${stepId}' after ${AGENT_TIMEOUT_MS / 1000}s`);
    this.name = 'AgentTimeoutError';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Role → Agent mapping
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STEP_TYPE_TO_ROLE: Record<StepType, AgentRole> = {
  spec: 'planner',
  review: 'reviewer',
  implement: 'implementer',
  test: 'tester',
  deploy: 'implementer',
};

const ROLE_TO_AGENT: Record<AgentRole, string> = {
  planner: 'architect',
  implementer: 'implementer',
  reviewer: 'security-reviewer',
  tester: 'tester',
  sentinel: 'SecuritySentinel',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CollaborationProtocol
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class CollaborationProtocol {
  private readonly messageLog: AgentMessage[] = [];
  private readonly handoffLog: HandoffResult[] = [];
  private readonly retryCount = new Map<string, number>();

  assignAgent(step: TaskStep): AgentAssignment {
    const role = STEP_TYPE_TO_ROLE[step.type];
    const agentName = ROLE_TO_AGENT[role];

    return {
      stepId: step.id,
      role,
      agentName,
      assignedAt: new Date().toISOString(),
    };
  }

  createMessage(
    from: string,
    to: string,
    type: MessageType,
    payload: unknown,
    correlationId?: string,
  ): AgentMessage {
    const message: AgentMessage = {
      id: uuidv7(),
      from,
      to,
      type,
      payload,
      correlationId: correlationId ?? uuidv7(),
      timestamp: new Date().toISOString(),
    };

    this.validateMessageSize(message);
    this.messageLog.push(message);
    return message;
  }

  handoff(from: string, to: string, context: HandoffContext): HandoffResult {
    const trimmedContext = this.trimContext(context);

    const handoffMessage = this.createMessage(from, to, 'handoff', trimmedContext);

    const result: HandoffResult = {
      id: handoffMessage.id,
      from,
      to,
      context: trimmedContext,
      success: true,
      timestamp: new Date().toISOString(),
    };

    this.handoffLog.push(result);
    return result;
  }

  canRetry(stepId: string): boolean {
    const count = this.retryCount.get(stepId) ?? 0;
    return count < MAX_RETRIES;
  }

  recordRetry(stepId: string): void {
    const count = this.retryCount.get(stepId) ?? 0;
    this.retryCount.set(stepId, count + 1);
  }

  getRetryCount(stepId: string): number {
    return this.retryCount.get(stepId) ?? 0;
  }

  getMessageLog(): ReadonlyArray<AgentMessage> {
    return this.messageLog;
  }

  getHandoffLog(): ReadonlyArray<HandoffResult> {
    return this.handoffLog;
  }

  getTimeoutMs(): number {
    return AGENT_TIMEOUT_MS;
  }

  getMaxMessageBytes(): number {
    return MAX_MESSAGE_BYTES;
  }

  private validateMessageSize(message: AgentMessage): void {
    const serialized = JSON.stringify(message);
    const byteLength = Buffer.byteLength(serialized, 'utf-8');
    if (byteLength > MAX_MESSAGE_BYTES) {
      throw new MessageSizeError(byteLength);
    }
  }

  private trimContext(context: HandoffContext): HandoffContext {
    return {
      files: context.files.slice(0, MAX_CONTEXT_ITEMS),
      changes: context.changes.slice(0, MAX_CONTEXT_ITEMS),
      decisions: context.decisions.slice(0, MAX_CONTEXT_ITEMS),
      metadata: context.metadata,
    };
  }
}
