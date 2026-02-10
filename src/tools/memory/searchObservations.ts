// Tool for searching structured observations

import { MemoryManager } from '../../core/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../core/types/tool.js';
import { ObservationType } from '../../core/lib/memory/ObservationStore.js';

export const searchObservationsDefinition: ToolDefinition = {
  name: 'search_observations',
  description: 'Search structured observations (decisions, bugfixes, features, refactors, discoveries)',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (FTS5 full-text search)' },
      type: {
        type: 'string',
        description: 'Filter by observation type',
        enum: ['decision', 'bugfix', 'feature', 'refactor', 'discovery']
      },
      limit: { type: 'number', description: 'Maximum results (default: 10)' },
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: []
  },
  annotations: {
    title: 'Search Observations',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface SearchObservationsArgs {
  query?: string;
  type?: ObservationType;
  limit?: number;
  projectPath?: string;
}

export async function searchObservations(args: SearchObservationsArgs): Promise<ToolResult> {
  try {
    const { query, type, limit = 10, projectPath } = args;
    const mm = MemoryManager.getInstance(projectPath);

    const results = query
      ? mm.searchObservations(query, limit)
      : mm.getRecentObservations(limit, type);

    if (results.length === 0) {
      return {
        content: [{ type: 'text', text: `No observations found${query ? ` for "${query}"` : ''}.` }]
      };
    }

    let output = `## Observations${query ? `: "${query}"` : ''}\n\n`;
    output += `**Count**: ${results.length}\n\n`;

    for (const obs of results) {
      const typeIcon = { decision: 'D', bugfix: 'B', feature: 'F', refactor: 'R', discovery: 'X' }[obs.type] || '?';
      output += `### [${typeIcon}] ${obs.title}\n`;
      output += `- **Type**: ${obs.type} | **Time**: ${new Date(obs.timestamp).toLocaleString()}\n`;

      if (obs.narrative) {
        const preview = obs.narrative.length > 150 ? obs.narrative.substring(0, 150) + '...' : obs.narrative;
        output += `- ${preview}\n`;
      }

      if (obs.facts.length > 0) {
        output += `- **Facts**: ${obs.facts.slice(0, 3).join('; ')}${obs.facts.length > 3 ? ` (+${obs.facts.length - 3})` : ''}\n`;
      }

      if (obs.filesModified.length > 0) {
        output += `- **Files**: ${obs.filesModified.slice(0, 3).join(', ')}${obs.filesModified.length > 3 ? ` (+${obs.filesModified.length - 3})` : ''}\n`;
      }

      output += '\n';
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
    };
  }
}
