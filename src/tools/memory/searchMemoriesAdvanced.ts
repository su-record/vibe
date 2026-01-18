// v2.0 - Advanced multi-strategy memory search

import { ToolResult, ToolDefinition, SearchStrategy } from '../../types/tool.js';
import { MemoryManager } from '../../lib/MemoryManager.js';

export const searchMemoriesAdvancedDefinition: ToolDefinition = {
  name: 'search_memories_advanced',
  description: `Performs advanced multi-strategy memory search.

Keywords: advanced search, find memories, smart search

**Search strategies:**
- keyword: Traditional keyword search
- graph_traversal: Graph-based related memory exploration
- temporal: Sort by time
- priority: Priority-based
- context_aware: Combined strategy (keyword + priority + recency)

Usage examples:
- "advanced search for authentication-related memories"
- "find memories related to project-architecture using graph traversal"`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      strategy: {
        type: 'string',
        description: 'Search strategy',
        enum: ['keyword', 'graph_traversal', 'temporal', 'priority', 'context_aware']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)'
      },
      category: {
        type: 'string',
        description: 'Category filter'
      },
      startKey: {
        type: 'string',
        description: 'Graph traversal start key (for graph_traversal strategy)'
      },
      depth: {
        type: 'number',
        description: 'Graph traversal depth (default: 2)'
      },
      includeRelations: {
        type: 'boolean',
        description: 'Whether to include relationship information'
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path for project-specific memory'
      }
    },
    required: ['query']
  },
  annotations: {
    title: 'Search Memories (Advanced)',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface SearchMemoriesAdvancedArgs {
  query: string;
  strategy?: SearchStrategy;
  limit?: number;
  category?: string;
  startKey?: string;
  depth?: number;
  includeRelations?: boolean;
  projectPath?: string;
}

export async function searchMemoriesAdvanced(args: SearchMemoriesAdvancedArgs): Promise<ToolResult> {
  try {
    const {
      query,
      strategy = 'context_aware',
      limit = 10,
      category,
      startKey,
      depth = 2,
      includeRelations = false,
      projectPath
    } = args;

    const memoryManager = MemoryManager.getInstance(projectPath);

    const results = memoryManager.searchAdvanced(query, strategy, {
      limit,
      category,
      startKey,
      depth,
      includeRelations
    });

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `✗ No search results for "${query}".

**Strategy used**: ${strategy}
${category ? `**Category filter**: ${category}` : ''}

Try a different search strategy:
- keyword: Basic keyword matching
- temporal: Newest memories first
- priority: Important memories first
- context_aware: Combined score`
        }]
      };
    }

    let output = `## Search Results: "${query}"\n\n`;
    output += `**Strategy**: ${getStrategyDescription(strategy)}\n`;
    output += `**Result count**: ${results.length}\n\n`;

    for (let i = 0; i < results.length; i++) {
      const memory = results[i];
      output += `### ${i + 1}. ${memory.key}\n`;
      output += `- **Category**: ${memory.category}\n`;
      output += `- **Priority**: ${memory.priority || 0}\n`;
      output += `- **Created**: ${formatDate(memory.timestamp)}\n`;
      output += `- **Last accessed**: ${formatDate(memory.lastAccessed)}\n`;

      // Include relations if requested
      if (includeRelations) {
        const relations = memoryManager.getRelations(memory.key, 'both');
        if (relations.length > 0) {
          output += `- **Relations**: ${relations.length}\n`;
          for (const rel of relations.slice(0, 3)) {
            const other = rel.sourceKey === memory.key ? rel.targetKey : rel.sourceKey;
            output += `  - ${rel.relationType} → ${other}\n`;
          }
          if (relations.length > 3) {
            output += `  - ... and ${relations.length - 3} more\n`;
          }
        }
      }

      // Show value preview
      const preview = memory.value.length > 200
        ? memory.value.substring(0, 200) + '...'
        : memory.value;
      output += `\n\`\`\`\n${preview}\n\`\`\`\n\n`;
    }

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
        text: `✗ Search error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

function getStrategyDescription(strategy: SearchStrategy): string {
  const descriptions: Record<SearchStrategy, string> = {
    keyword: 'Keyword matching',
    graph_traversal: 'Graph traversal',
    temporal: 'Time-based sorting',
    priority: 'Priority-based',
    context_aware: 'Combined strategy (keyword + priority + recency)'
  };
  return descriptions[strategy] || strategy;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch { /* ignore: optional operation */
    return dateString;
  }
}
