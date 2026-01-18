// v2.1 - Get session context for automatic context injection
// This tool aggregates memories, knowledge graph, and timeline for session start

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { MemoryManager } from '../../lib/MemoryManager.js';

export const getSessionContextDefinition: ToolDefinition = {
  name: 'get_session_context',
  description: `[Recommended at session/conversation start] Retrieves memories, knowledge graph, and recent work history from previous sessions at once.

This tool is best run first when starting a new conversation. It helps quickly understand the project context.

Keywords: session start, context, previous work, what did we do, history, resume

Examples:
- "What did we work on before?"
- "Show me the project context"
- "Get session context"`,
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Filter by project name (optional)'
      },
      category: {
        type: 'string',
        description: 'Filter by category (optional)'
      },
      memoryLimit: {
        type: 'number',
        description: 'Number of memories to retrieve (default: 15)',
        default: 15
      },
      includeGraph: {
        type: 'boolean',
        description: 'Include knowledge graph (default: true)',
        default: true
      },
      includeTimeline: {
        type: 'boolean',
        description: 'Include timeline (default: true)',
        default: true
      },
      timeRange: {
        type: 'string',
        description: 'Timeline query range',
        enum: ['1d', '7d', '30d', 'all'],
        default: '7d'
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path for project-specific memory'
      }
    }
  },
  annotations: {
    title: 'Get Session Context',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface GetSessionContextArgs {
  projectName?: string;
  category?: string;
  memoryLimit?: number;
  includeGraph?: boolean;
  includeTimeline?: boolean;
  timeRange?: '1d' | '7d' | '30d' | 'all';
  projectPath?: string;
}

export async function getSessionContext(args: GetSessionContextArgs): Promise<ToolResult> {
  try {
    const {
      projectName,
      category,
      memoryLimit = 15,
      includeGraph = true,
      includeTimeline = true,
      timeRange = '7d',
      projectPath
    } = args;

    const memoryManager = MemoryManager.getInstance(projectPath);
    const sections: string[] = [];

    // Header
    sections.push('# Session Context\n');
    sections.push(`> Memory and work history from previous sessions.\n`);

    // 1. Memory Statistics
    const stats = memoryManager.getStats();
    sections.push('## Memory Statistics\n');
    sections.push(`- **Total memories**: ${stats.total}`);

    const categoryStats = Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    sections.push(`- **Categories**: ${categoryStats || 'None'}\n`);

    // 2. Recent Memories (Priority-sorted)
    sections.push('## Key Memories\n');

    let memories = memoryManager.list(category);

    // Filter by project name if specified
    if (projectName) {
      memories = memories.filter(m =>
        m.key.toLowerCase().includes(projectName.toLowerCase()) ||
        m.value.toLowerCase().includes(projectName.toLowerCase()) ||
        m.category.toLowerCase().includes(projectName.toLowerCase())
      );
    }

    // Sort by priority (desc) then timestamp (desc)
    memories.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const topMemories = memories.slice(0, memoryLimit);

    if (topMemories.length === 0) {
      sections.push('_No memories stored._\n');
    } else {
      for (const memory of topMemories) {
        const priority = memory.priority ? `⭐${memory.priority}` : '';
        const preview = memory.value.length > 120
          ? memory.value.substring(0, 120) + '...'
          : memory.value;
        const date = formatDate(memory.timestamp);

        sections.push(`### ${memory.key} ${priority}`);
        sections.push(`**[${memory.category}]** | ${date}`);
        sections.push(`> ${preview}\n`);
      }
    }

    // 3. Knowledge Graph (if enabled and has relations)
    if (includeGraph && memories.length > 0) {
      const graph = memoryManager.getMemoryGraph(undefined, 2);

      if (graph.edges.length > 0) {
        sections.push('## Knowledge Graph\n');

        // Show key relationships
        const relationSummary = summarizeRelations(graph.edges);
        sections.push(relationSummary);

        // Show clusters
        if (graph.clusters.length > 0) {
          sections.push('\n**Related groups**:');
          for (const cluster of graph.clusters.slice(0, 3)) {
            sections.push(`- [${cluster.join(' ↔ ')}]`);
          }
        }
        sections.push('');
      }
    }

    // 4. Recent Timeline (if enabled)
    if (includeTimeline) {
      sections.push('## Recent Timeline\n');

      const startDate = getStartDate(timeRange);
      const timeline = memoryManager.getTimeline(startDate, undefined, 10);

      if (timeline.length === 0) {
        sections.push('_No recent activity._\n');
      } else {
        const groupedByDate = groupByDate(timeline);

        for (const [date, items] of Object.entries(groupedByDate).slice(0, 5)) {
          sections.push(`**${date}**`);
          for (const item of (items as any[]).slice(0, 3)) {
            sections.push(`- \`${item.key}\`: ${item.value.substring(0, 50)}${item.value.length > 50 ? '...' : ''}`);
          }
        }
        sections.push('');
      }
    }

    // 5. Quick Actions Hint
    sections.push('---');
    sections.push('## Next Steps\n');
    sections.push('- View specific memory details: `recall_memory`');
    sections.push('- Save new memory: `save_memory`');
    sections.push('- Explore graph: `get_memory_graph`');
    sections.push('- Advanced search: `search_memories_advanced`');

    return {
      content: [{
        type: 'text',
        text: sections.join('\n')
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `✗ Session context retrieval error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US');
  } catch { /* ignore: optional operation */
    return timestamp.substring(0, 10);
  }
}

function getStartDate(timeRange: string): string | undefined {
  const now = new Date();

  switch (timeRange) {
    case '1d':
      now.setDate(now.getDate() - 1);
      break;
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case 'all':
      return undefined;
    default:
      now.setDate(now.getDate() - 7);
  }

  return now.toISOString();
}

function groupByDate(memories: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const memory of memories) {
    const date = memory.timestamp.substring(0, 10);
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(memory);
  }

  return grouped;
}

function summarizeRelations(edges: any[]): string {
  const relationTypes: Record<string, number> = {};

  for (const edge of edges) {
    relationTypes[edge.relationType] = (relationTypes[edge.relationType] || 0) + 1;
  }

  const lines: string[] = [];

  // Show top 5 relations
  const topEdges = edges.slice(0, 5);
  for (const edge of topEdges) {
    const arrow = getRelationArrow(edge.relationType);
    lines.push(`- ${edge.sourceKey} ${arrow} ${edge.targetKey} (${edge.relationType})`);
  }

  if (edges.length > 5) {
    lines.push(`- _... and ${edges.length - 5} more relations_`);
  }

  return lines.join('\n');
}

function getRelationArrow(relationType: string): string {
  const arrows: Record<string, string> = {
    'related_to': '↔',
    'depends_on': '←',
    'implements': '→',
    'extends': '⊃',
    'uses': '→',
    'references': '⇢',
    'part_of': '⊂'
  };
  return arrows[relationType] || '→';
}
