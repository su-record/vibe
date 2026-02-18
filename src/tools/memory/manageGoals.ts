// Manage session goals (list, update, complete)

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { GoalStatus } from '../../infra/lib/memory/SessionRAGStore.js';

export const manageGoalsDefinition: ToolDefinition = {
  name: 'manage_goals',
  description: 'goal|목표|progress|완료 - Manage session goals',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'update', 'complete'],
        description: 'Action to perform: list active goals, update goal, or mark complete',
      },
      goalId: {
        type: 'number',
        description: 'Goal ID (required for update/complete actions)',
      },
      progressPercent: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Progress percentage for update action',
      },
      status: {
        type: 'string',
        enum: ['active', 'completed', 'blocked', 'cancelled'],
        description: 'Status for update action',
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path',
      },
    },
    required: ['action'],
  },
  annotations: {
    title: 'Manage Goals',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function manageGoals(args: {
  action: 'list' | 'update' | 'complete';
  goalId?: number;
  progressPercent?: number;
  status?: GoalStatus;
  projectPath?: string;
}): Promise<ToolResult> {
  const { action, goalId, progressPercent, status, projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);

    switch (action) {
      case 'list': {
        const goals = memoryManager.getActiveGoals(20);
        if (goals.length === 0) {
          return {
            content: [{ type: 'text', text: 'No active goals found.' }],
          };
        }

        let markdown = `# Active Goals (${goals.length})\n\n`;
        goals.forEach(goal => {
          const statusEmoji = { active: '🎯', completed: '✅', blocked: '🚫', cancelled: '❌' }[goal.status];
          markdown += `## ${statusEmoji} ${goal.title} (ID: ${goal.id})\n`;
          if (goal.description) markdown += `${goal.description}\n\n`;
          markdown += `**Progress:** ${goal.progressPercent}% | **Priority:** ${goal.priority} | **Status:** ${goal.status}\n`;
          if (goal.successCriteria.length > 0) {
            markdown += `**Success Criteria:**\n`;
            goal.successCriteria.forEach(c => markdown += `  - ${c}\n`);
          }
          markdown += `**Created:** ${new Date(goal.timestamp).toLocaleString()}\n`;
          if (goal.completedAt) {
            markdown += `**Completed:** ${new Date(goal.completedAt).toLocaleString()}\n`;
          }
          markdown += `\n---\n\n`;
        });

        return {
          content: [{ type: 'text', text: markdown }],
        };
      }

      case 'update': {
        if (goalId === undefined) {
          return {
            content: [{ type: 'text', text: 'Error: goalId is required for update action' }],
            isError: true,
          };
        }

        const updates: { progressPercent?: number; status?: GoalStatus } = {};
        if (progressPercent !== undefined) updates.progressPercent = progressPercent;
        if (status !== undefined) updates.status = status;

        if (Object.keys(updates).length === 0) {
          return {
            content: [{ type: 'text', text: 'Error: No updates provided (specify progressPercent or status)' }],
            isError: true,
          };
        }

        const success = memoryManager.updateGoal(goalId, updates);
        if (!success) {
          return {
            content: [{ type: 'text', text: `Error: Goal ${goalId} not found or update failed` }],
            isError: true,
          };
        }

        const goal = memoryManager.getGoal(goalId);
        let message = `Goal ${goalId} updated successfully.\n\n`;
        if (goal) {
          message += `**${goal.title}**\n`;
          message += `Progress: ${goal.progressPercent}% | Status: ${goal.status}\n`;
        }

        return {
          content: [{ type: 'text', text: message }],
        };
      }

      case 'complete': {
        if (goalId === undefined) {
          return {
            content: [{ type: 'text', text: 'Error: goalId is required for complete action' }],
            isError: true,
          };
        }

        const success = memoryManager.updateGoal(goalId, { status: 'completed', progressPercent: 100 });
        if (!success) {
          return {
            content: [{ type: 'text', text: `Error: Goal ${goalId} not found` }],
            isError: true,
          };
        }

        const goal = memoryManager.getGoal(goalId);
        let message = `✅ Goal ${goalId} marked as completed!\n\n`;
        if (goal) {
          message += `**${goal.title}**\n`;
          message += `Completed at: ${goal.completedAt ? new Date(goal.completedAt).toLocaleString() : 'now'}\n`;
        }

        return {
          content: [{ type: 'text', text: message }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown action "${action}"` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Failed to manage goals: ${message}` }],
      isError: true,
    };
  }
}
