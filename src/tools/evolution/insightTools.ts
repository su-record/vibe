// Insight tools for self-evolution

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { MemoryStorage } from '../../infra/lib/memory/MemoryStorage.js';
import { InsightExtractor } from '../../infra/lib/evolution/InsightExtractor.js';
import { InsightStore } from '../../infra/lib/evolution/InsightStore.js';
import { SkillGapDetector } from '../../infra/lib/evolution/SkillGapDetector.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';

// ============================================================================
// core_extract_insights
// ============================================================================

export const extractInsightsDefinition: ToolDefinition = {
  name: 'core_extract_insights',
  description: 'Extract insights from accumulated reflections and observations. Finds patterns, anti-patterns, and skill gaps.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max items to process (default 50)' },
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: []
  },
  annotations: {
    title: 'Extract Insights',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
};

export async function extractInsights(args: { limit?: number; projectPath?: string }): Promise<ToolResult> {
  try {
    const mm = MemoryManager.getInstance(args.projectPath);
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const extractor = new InsightExtractor(storage);

    const result = extractor.extractFromRecent(args.limit ?? 50);

    // Also run skill gap detection
    const gapDetector = new SkillGapDetector(storage);
    const gapResult = gapDetector.analyze();

    return {
      content: [{
        type: 'text',
        text: `📊 Insight Extraction Complete\n` +
              `  New insights: ${result.newInsights.length}\n` +
              `  Merged (duplicates): ${result.mergedInsights.length}\n` +
              `  Skipped (< 3 occurrences): ${result.skippedCount}\n` +
              `  Errors: ${result.errorCount}\n` +
              `  Skill gaps detected: ${gapResult.newGaps.length}\n` +
              `  Gap clusters analyzed: ${gapResult.totalClusters}`
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
// core_search_insights
// ============================================================================

export const searchInsightsDefinition: ToolDefinition = {
  name: 'core_search_insights',
  description: 'Search insights by keyword.',
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
    title: 'Search Insights',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function searchInsights(args: { query: string; limit?: number; projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const store = new InsightStore(storage);
    const results = store.search(args.query, args.limit ?? 10);

    if (results.length === 0) {
      return { content: [{ type: 'text', text: `No insights found for "${args.query}"` }] };
    }

    const formatted = results.map((r, i) =>
      `  ${i + 1}. [${r.type}] ${r.title} (confidence=${r.confidence.toFixed(2)}, occurrences=${r.occurrences}, status=${r.status})`
    ).join('\n');

    return { content: [{ type: 'text', text: `Found ${results.length} insights:\n${formatted}` }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_list_skill_gaps
// ============================================================================

export const listSkillGapsDefinition: ToolDefinition = {
  name: 'core_list_skill_gaps',
  description: 'List detected skill gaps from prompt-dispatcher misses.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: []
  },
  annotations: {
    title: 'List Skill Gaps',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function listSkillGaps(args: { projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const store = new InsightStore(storage);
    const gaps = store.getByType('skill_gap');

    if (gaps.length === 0) {
      return { content: [{ type: 'text', text: 'No skill gaps detected yet.' }] };
    }

    const formatted = gaps.map((g, i) =>
      `  ${i + 1}. ${g.title} (confidence=${g.confidence.toFixed(2)}, occurrences=${g.occurrences})`
    ).join('\n');

    return { content: [{ type: 'text', text: `Detected ${gaps.length} skill gaps:\n${formatted}` }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_insight_stats
// ============================================================================

export const insightStatsDefinition: ToolDefinition = {
  name: 'core_insight_stats',
  description: 'Get insight statistics (counts by type and status).',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Project directory path' }
    },
    required: []
  },
  annotations: {
    title: 'Insight Stats',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function insightStats(args: { projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const store = new InsightStore(storage);
    const stats = store.getStats();

    const typeLines = Object.entries(stats.byType).map(([k, v]) => `    ${k}: ${v}`).join('\n') || '    (none)';
    const statusLines = Object.entries(stats.byStatus).map(([k, v]) => `    ${k}: ${v}`).join('\n') || '    (none)';

    return {
      content: [{
        type: 'text',
        text: `📊 Insight Statistics\n  Total: ${stats.total}\n  By type:\n${typeLines}\n  By status:\n${statusLines}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
