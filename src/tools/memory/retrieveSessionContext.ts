// Retrieve relevant session context via hybrid search

import { MemoryManager } from '../../core/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../core/types/tool.js';

export const retrieveSessionContextDefinition: ToolDefinition = {
  name: 'retrieve_session_context',
  description: 'context|retrieve|session|세션 - Retrieve relevant session context',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find relevant context',
      },
      sessionId: {
        type: 'string',
        description: 'Optional session ID to filter by',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        description: 'Maximum number of results per category (default: 5)',
      },
      projectPath: {
        type: 'string',
        description: 'Project directory path',
      },
    },
    required: ['query'],
  },
  annotations: {
    title: 'Retrieve Session Context',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function retrieveSessionContext(args: {
  query: string;
  sessionId?: string;
  limit?: number;
  projectPath?: string;
}): Promise<ToolResult> {
  const { query, sessionId, limit = 5, projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);
    const result = memoryManager.retrieveSessionContext({
      query,
      sessionId,
      limit,
    });

    let markdown = `# Session Context Search Results\n`;
    markdown += `Query: "${query}"\n`;
    markdown += `Time: ${result.queryTime}ms\n\n`;

    // Decisions
    if (result.decisions.length > 0) {
      markdown += `## Decisions (${result.decisions.length})\n\n`;
      result.decisions.forEach(({ item, score, breakdown }) => {
        markdown += `### ${item.title} [Score: ${score.toFixed(3)}]\n`;
        if (item.description) markdown += `${item.description}\n\n`;
        if (item.rationale) markdown += `**Rationale:** ${item.rationale}\n\n`;
        if (item.impact) markdown += `**Impact:** ${item.impact}\n\n`;
        markdown += `**Priority:** ${item.priority} | **Status:** ${item.status}\n`;
        markdown += `**Score breakdown:** BM25=${breakdown.bm25.toFixed(2)}, Recency=${breakdown.recency.toFixed(2)}, Priority=${breakdown.priority.toFixed(2)}\n`;
        if (item.tags.length > 0) markdown += `**Tags:** ${item.tags.join(', ')}\n`;
        markdown += `**Date:** ${new Date(item.timestamp).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    // Constraints
    if (result.constraints.length > 0) {
      markdown += `## Constraints (${result.constraints.length})\n\n`;
      result.constraints.forEach(({ item, score, breakdown }) => {
        const severityEmoji = { critical: '🔴', high: '🟡', medium: '🔵', low: '🟢' }[item.severity];
        markdown += `### ${severityEmoji} ${item.title} [Score: ${score.toFixed(3)}]\n`;
        if (item.description) markdown += `${item.description}\n\n`;
        markdown += `**Type:** ${item.type} | **Severity:** ${item.severity}\n`;
        markdown += `**Score breakdown:** BM25=${breakdown.bm25.toFixed(2)}, Recency=${breakdown.recency.toFixed(2)}, Priority=${breakdown.priority.toFixed(2)}\n`;
        if (item.scope) markdown += `**Scope:** ${item.scope}\n`;
        markdown += `**Date:** ${new Date(item.timestamp).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    // Goals
    if (result.goals.length > 0) {
      markdown += `## Goals (${result.goals.length})\n\n`;
      result.goals.forEach(({ item, score, breakdown }) => {
        const statusEmoji = { active: '🎯', completed: '✅', blocked: '🚫', cancelled: '❌' }[item.status];
        markdown += `### ${statusEmoji} ${item.title} [Score: ${score.toFixed(3)}]\n`;
        if (item.description) markdown += `${item.description}\n\n`;
        markdown += `**Status:** ${item.status} | **Progress:** ${item.progressPercent}% | **Priority:** ${item.priority}\n`;
        markdown += `**Score breakdown:** BM25=${breakdown.bm25.toFixed(2)}, Recency=${breakdown.recency.toFixed(2)}, Priority=${breakdown.priority.toFixed(2)}\n`;
        if (item.successCriteria.length > 0) {
          markdown += `**Success Criteria:**\n`;
          item.successCriteria.forEach(c => markdown += `  - ${c}\n`);
        }
        markdown += `**Date:** ${new Date(item.timestamp).toLocaleString()}\n`;
        if (item.completedAt) markdown += `**Completed:** ${new Date(item.completedAt).toLocaleString()}\n`;
        markdown += `\n---\n\n`;
      });
    }

    // Evidence
    if (result.evidence.length > 0) {
      markdown += `## Evidence (${result.evidence.length})\n\n`;
      result.evidence.forEach(({ item, score, breakdown }) => {
        const statusEmoji = { pass: '✅', fail: '❌', warning: '⚠️', info: 'ℹ️' }[item.status];
        markdown += `### ${statusEmoji} ${item.title} [Score: ${score.toFixed(3)}]\n`;
        markdown += `**Type:** ${item.type} | **Status:** ${item.status}\n`;
        markdown += `**Score breakdown:** BM25=${breakdown.bm25.toFixed(2)}, Recency=${breakdown.recency.toFixed(2)}, Priority=${breakdown.priority.toFixed(2)}\n`;
        if (item.metrics) {
          markdown += `**Metrics:**\n\`\`\`json\n${JSON.stringify(item.metrics, null, 2)}\n\`\`\`\n`;
        }
        if (item.relatedGoals.length > 0) {
          markdown += `**Related Goals:** ${item.relatedGoals.join(', ')}\n`;
        }
        markdown += `**Date:** ${new Date(item.timestamp).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
      });
    }

    if (result.decisions.length === 0 && result.constraints.length === 0 &&
        result.goals.length === 0 && result.evidence.length === 0) {
      markdown += `No relevant session context found for query "${query}".\n`;
    }

    return {
      content: [{ type: 'text', text: markdown }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Failed to retrieve session context: ${message}` }],
      isError: true,
    };
  }
}
