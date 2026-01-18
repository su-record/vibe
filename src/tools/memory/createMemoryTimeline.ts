// v2.0 - Create memory timeline visualization

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { MemoryManager } from '../../lib/MemoryManager.js';

export const createMemoryTimelineDefinition: ToolDefinition = {
  name: 'create_memory_timeline',
  description: `Creates a memory timeline visualization.

Keywords: timeline, history, chronological, time-based

Examples:
- "Show me the recent memory timeline"
- "Memory history for the last 7 days"`,
  inputSchema: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Start date (ISO format, e.g., 2024-01-01)'
      },
      endDate: {
        type: 'string',
        description: 'End date (ISO format)'
      },
      category: {
        type: 'string',
        description: 'Category filter'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20)'
      },
      groupBy: {
        type: 'string',
        description: 'Grouping criterion',
        enum: ['day', 'week', 'month', 'category']
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path for project-specific memory'
      }
    }
  },
  annotations: {
    title: 'Create Memory Timeline',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface CreateMemoryTimelineArgs {
  startDate?: string;
  endDate?: string;
  category?: string;
  limit?: number;
  groupBy?: 'day' | 'week' | 'month' | 'category';
  projectPath?: string;
}

export async function createMemoryTimeline(args: CreateMemoryTimelineArgs): Promise<ToolResult> {
  try {
    const {
      startDate,
      endDate,
      category,
      limit = 20,
      groupBy = 'day',
      projectPath
    } = args;

    const memoryManager = MemoryManager.getInstance(projectPath);
    let memories = memoryManager.getTimeline(startDate, endDate, limit);

    // Filter by category if specified
    if (category) {
      memories = memories.filter(m => m.category === category);
    }

    if (memories.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `✗ No memories found in the specified period.

${startDate ? `**Start date**: ${startDate}` : ''}
${endDate ? `**End date**: ${endDate}` : ''}
${category ? `**Category**: ${category}` : ''}`
        }]
      };
    }

    let output = '## Memory Timeline\n\n';

    // Add filter info
    if (startDate || endDate || category) {
      output += '**Filters**:\n';
      if (startDate) output += `- Start: ${startDate}\n`;
      if (endDate) output += `- End: ${endDate}\n`;
      if (category) output += `- Category: ${category}\n`;
      output += '\n';
    }

    // Group memories
    const grouped = groupMemories(memories, groupBy);

    for (const [groupKey, groupMemories] of Object.entries(grouped)) {
      output += `### ${formatGroupKey(groupKey, groupBy)}\n\n`;

      for (const memory of groupMemories as any[]) {
        const time = formatTime(memory.timestamp);
        const priority = memory.priority ? `⭐${memory.priority}` : '';
        const preview = memory.value.length > 100
          ? memory.value.substring(0, 100) + '...'
          : memory.value;

        output += `**${time}** | \`${memory.key}\` ${priority}\n`;
        output += `> ${preview}\n\n`;
      }
    }

    // Statistics
    const stats = generateTimelineStats(memories);
    output += `---\n## Statistics\n${stats}`;

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `✗ Timeline creation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

function groupMemories(
  memories: any[],
  groupBy: 'day' | 'week' | 'month' | 'category'
): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const memory of memories) {
    let key: string;

    switch (groupBy) {
      case 'day':
        key = memory.timestamp.substring(0, 10); // YYYY-MM-DD
        break;
      case 'week':
        const date = new Date(memory.timestamp);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().substring(0, 10);
        break;
      case 'month':
        key = memory.timestamp.substring(0, 7); // YYYY-MM
        break;
      case 'category':
        key = memory.category;
        break;
      default:
        key = memory.timestamp.substring(0, 10);
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(memory);
  }

  return grouped;
}

function formatGroupKey(key: string, groupBy: string): string {
  switch (groupBy) {
    case 'day':
      return `📅 ${key}`;
    case 'week':
      return `📆 Week of ${key}`;
    case 'month':
      return `🗓️ ${key}`;
    case 'category':
      return `📁 ${key}`;
    default:
      return key;
  }
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch { /* ignore: optional operation */
    return timestamp.substring(11, 16);
  }
}

function generateTimelineStats(memories: any[]): string {
  const categories: Record<string, number> = {};
  let totalPriority = 0;
  let priorityCount = 0;

  for (const memory of memories) {
    categories[memory.category] = (categories[memory.category] || 0) + 1;
    if (memory.priority) {
      totalPriority += memory.priority;
      priorityCount++;
    }
  }

  let stats = `- **Total memories**: ${memories.length}\n`;
  stats += `- **Average priority**: ${priorityCount > 0 ? (totalPriority / priorityCount).toFixed(1) : 'N/A'}\n`;
  stats += `- **Category distribution**:\n`;

  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    const percentage = ((count / memories.length) * 100).toFixed(1);
    stats += `  - ${cat}: ${count} (${percentage}%)\n`;
  }

  return stats;
}
