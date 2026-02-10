// Save structured session items (decisions, constraints, goals, evidence)

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import {
  DecisionInput,
  ConstraintInput,
  GoalInput,
  EvidenceInput,
} from '../../infra/lib/memory/SessionRAGStore.js';

export const saveSessionItemDefinition: ToolDefinition = {
  name: 'save_session_item',
  description: 'decision|constraint|goal|evidence|결정|제약|목표|증거 - Save structured session item',
  inputSchema: {
    type: 'object',
    properties: {
      itemType: {
        type: 'string',
        enum: ['decision', 'constraint', 'goal', 'evidence'],
        description: 'Type of session item to save',
      },
      title: {
        type: 'string',
        description: 'Title/summary of the item',
      },
      description: {
        type: 'string',
        description: 'Optional detailed description',
      },
      // Decision-specific fields
      rationale: {
        type: 'string',
        description: '(Decision) Reasoning behind the decision',
      },
      alternatives: {
        type: 'array',
        items: { type: 'string' },
        description: '(Decision) Alternative options considered',
      },
      impact: {
        type: 'string',
        description: '(Decision) Expected impact of the decision',
      },
      priority: {
        type: 'number',
        minimum: 0,
        maximum: 2,
        description: '(Decision/Goal) Priority level (0=low, 1=medium, 2=high)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '(Decision) Tags for categorization',
      },
      relatedFiles: {
        type: 'array',
        items: { type: 'string' },
        description: '(Decision) Related file paths',
      },
      // Constraint-specific fields
      type: {
        type: 'string',
        enum: ['technical', 'business', 'resource', 'quality'],
        description: '(Constraint) Type of constraint',
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: '(Constraint) Severity level',
      },
      scope: {
        type: 'string',
        description: '(Constraint) Scope of the constraint',
      },
      // Goal-specific fields
      progressPercent: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: '(Goal) Progress percentage (0-100)',
      },
      successCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: '(Goal) Success criteria checklist',
      },
      parentId: {
        type: 'number',
        description: '(Goal) Parent goal ID for hierarchical goals',
      },
      // Evidence-specific fields
      evidenceType: {
        type: 'string',
        enum: ['test', 'build', 'lint', 'coverage', 'hud', 'review'],
        description: '(Evidence) Type of evidence',
      },
      status: {
        type: 'string',
        enum: ['pass', 'fail', 'warning', 'info'],
        description: '(Evidence) Status of the evidence',
      },
      metrics: {
        type: 'object',
        description: '(Evidence) Metrics data (JSON object)',
      },
      relatedGoals: {
        type: 'array',
        items: { type: 'number' },
        description: '(Evidence) Related goal IDs',
      },
      // Common fields
      sessionId: {
        type: 'string',
        description: 'Session identifier (optional)',
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path',
      },
    },
    required: ['itemType', 'title'],
  },
  annotations: {
    title: 'Save Session Item',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function saveSessionItem(args: {
  itemType: 'decision' | 'constraint' | 'goal' | 'evidence';
  title: string;
  description?: string;
  // Decision fields
  rationale?: string;
  alternatives?: string[];
  impact?: string;
  priority?: number;
  tags?: string[];
  relatedFiles?: string[];
  // Constraint fields
  type?: 'technical' | 'business' | 'resource' | 'quality';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  scope?: string;
  // Goal fields
  progressPercent?: number;
  successCriteria?: string[];
  parentId?: number;
  // Evidence fields
  evidenceType?: 'test' | 'build' | 'lint' | 'coverage' | 'hud' | 'review';
  status?: 'pass' | 'fail' | 'warning' | 'info';
  metrics?: Record<string, unknown>;
  relatedGoals?: number[];
  // Common
  sessionId?: string;
  projectPath?: string;
}): Promise<ToolResult> {
  const { itemType, projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);
    let id: number;
    let itemName: string;

    switch (itemType) {
      case 'decision': {
        const input: DecisionInput = {
          title: args.title,
          description: args.description,
          rationale: args.rationale,
          alternatives: args.alternatives,
          impact: args.impact,
          priority: args.priority,
          tags: args.tags,
          relatedFiles: args.relatedFiles,
          sessionId: args.sessionId,
        };
        id = memoryManager.addDecision(input);
        itemName = 'Decision';
        break;
      }

      case 'constraint': {
        if (!args.type) {
          return {
            content: [{ type: 'text', text: 'Error: "type" field is required for constraints' }],
            isError: true,
          };
        }
        const input: ConstraintInput = {
          title: args.title,
          description: args.description,
          type: args.type,
          severity: args.severity,
          scope: args.scope,
          sessionId: args.sessionId,
        };
        id = memoryManager.addConstraint(input);
        itemName = 'Constraint';
        break;
      }

      case 'goal': {
        const input: GoalInput = {
          title: args.title,
          description: args.description,
          priority: args.priority,
          progressPercent: args.progressPercent,
          successCriteria: args.successCriteria,
          parentId: args.parentId,
          sessionId: args.sessionId,
        };
        id = memoryManager.addGoal(input);
        itemName = 'Goal';
        break;
      }

      case 'evidence': {
        if (!args.evidenceType || !args.status) {
          return {
            content: [{ type: 'text', text: 'Error: "evidenceType" and "status" fields are required for evidence' }],
            isError: true,
          };
        }
        const input: EvidenceInput = {
          title: args.title,
          type: args.evidenceType,
          status: args.status,
          details: args.description ? { description: args.description } : undefined,
          metrics: args.metrics,
          relatedGoals: args.relatedGoals,
          sessionId: args.sessionId,
        };
        id = memoryManager.addEvidence(input);
        itemName = 'Evidence';
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown item type "${itemType}"` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: `${itemName} saved successfully (ID: ${id})` }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Failed to save session item: ${message}` }],
      isError: true,
    };
  }
}
