// Reflection tools for self-evolution Phase 1
// core_reflect_now, core_search_reflections, core_get_session_reflections

import { MemoryManager } from '../../core/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../core/types/tool.js';

// ============================================================================
// core_reflect_now - 수동 reflection 트리거
// ============================================================================

export const reflectNowDefinition: ToolDefinition = {
  name: 'core_reflect_now',
  description: 'Trigger manual reflection to capture current session state (decisions, patterns, learnings). Use when you want to explicitly record insights before context compression or session end.',
  inputSchema: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key learnings from current session'
      },
      decisions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Confirmed decisions made in this session'
      },
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Discovered patterns or anti-patterns'
      },
      filesContext: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related file paths'
      },
      score: {
        type: 'number',
        description: 'Importance score (0-1, default 0.7)'
      },
      sessionId: { type: 'string', description: 'Session identifier' },
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: []
  },
  annotations: {
    title: 'Reflect Now',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
};

interface ReflectNowArgs {
  insights?: string[];
  decisions?: string[];
  patterns?: string[];
  filesContext?: string[];
  score?: number;
  sessionId?: string;
  projectPath?: string;
}

export async function reflectNow(args: ReflectNowArgs): Promise<ToolResult> {
  try {
    const mm = MemoryManager.getInstance(args.projectPath);
    const store = mm.getReflectionStore();
    const id = store.save({
      type: 'minor',
      trigger: 'manual',
      insights: args.insights,
      decisions: args.decisions,
      patterns: args.patterns,
      filesContext: args.filesContext,
      score: args.score ?? 0.7,
      sessionId: args.sessionId,
    });

    const itemCount = (args.insights?.length ?? 0) + (args.decisions?.length ?? 0) + (args.patterns?.length ?? 0);
    return {
      content: [{
        type: 'text',
        text: `✅ Reflection saved (id: ${id})\n` +
              `  Type: manual | Items: ${itemCount}\n` +
              `  Score: ${args.score ?? 0.7}\n` +
              `  Insights: ${args.insights?.length ?? 0}, Decisions: ${args.decisions?.length ?? 0}, Patterns: ${args.patterns?.length ?? 0}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_search_reflections - reflection 검색
// ============================================================================

export const searchReflectionsDefinition: ToolDefinition = {
  name: 'core_search_reflections',
  description: 'Search past reflections by keyword. Uses FTS5 full-text search with score weighting.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results (default 10)' },
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: ['query']
  },
  annotations: {
    title: 'Search Reflections',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface SearchReflectionsArgs {
  query: string;
  limit?: number;
  projectPath?: string;
}

export async function searchReflections(args: SearchReflectionsArgs): Promise<ToolResult> {
  try {
    const mm = MemoryManager.getInstance(args.projectPath);
    const store = mm.getReflectionStore();
    const results = store.search(args.query, args.limit ?? 10);

    if (results.length === 0) {
      return { content: [{ type: 'text', text: `No reflections found for "${args.query}"` }] };
    }

    const formatted = results.map((r, i) => {
      const insights = r.insights.length > 0 ? `\n    Insights: ${r.insights.join(', ')}` : '';
      const decisions = r.decisions.length > 0 ? `\n    Decisions: ${r.decisions.join(', ')}` : '';
      const patterns = r.patterns.length > 0 ? `\n    Patterns: ${r.patterns.join(', ')}` : '';
      return `  ${i + 1}. [${r.type}/${r.trigger}] score=${r.score.toFixed(2)} (${r.createdAt})${insights}${decisions}${patterns}`;
    }).join('\n');

    return {
      content: [{ type: 'text', text: `Found ${results.length} reflections:\n${formatted}` }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_get_session_reflections - 특정 세션의 reflections
// ============================================================================

export const getSessionReflectionsDefinition: ToolDefinition = {
  name: 'core_get_session_reflections',
  description: 'Get all reflections from a specific session.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Session identifier' },
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: ['sessionId']
  },
  annotations: {
    title: 'Get Session Reflections',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

interface GetSessionReflectionsArgs {
  sessionId: string;
  projectPath?: string;
}

export async function getSessionReflections(args: GetSessionReflectionsArgs): Promise<ToolResult> {
  try {
    const mm = MemoryManager.getInstance(args.projectPath);
    const store = mm.getReflectionStore();
    const results = store.getBySession(args.sessionId);

    if (results.length === 0) {
      return { content: [{ type: 'text', text: `No reflections found for session "${args.sessionId}"` }] };
    }

    const formatted = results.map((r, i) => {
      return `  ${i + 1}. [${r.type}/${r.trigger}] score=${r.score.toFixed(2)}\n` +
             `     Insights: ${r.insights.join('; ') || 'none'}\n` +
             `     Decisions: ${r.decisions.join('; ') || 'none'}\n` +
             `     Patterns: ${r.patterns.join('; ') || 'none'}`;
    }).join('\n');

    return {
      content: [{ type: 'text', text: `Session ${args.sessionId}: ${results.length} reflections\n${formatted}` }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
