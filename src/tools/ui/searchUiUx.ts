// UI/UX Search Tool - BM25 domain search across 12 design intelligence domains

import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import { SearchService } from '../../infra/lib/ui-ux/SearchService.js';
import type { SearchDomain } from '../../infra/lib/ui-ux/types.js';

// Singleton SearchService instance
let searchService: SearchService | null = null;

function getSearchService(): SearchService {
  if (!searchService) {
    searchService = new SearchService();
    searchService.initialize();
  }
  return searchService;
}

export const searchUiUxDefinition: ToolDefinition = {
  name: 'core_ui_search',
  description: 'search design|find style|color palette|ux guideline|typography|landing pattern|chart recommendation - BM25 search across UI/UX design intelligence data (12 domains: style, color, chart, landing, product, ux, typography, icons, react, web, prompt, ui-reasoning)',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "SaaS dashboard", "glassmorphism", "color for finance app")'
      },
      domain: {
        type: 'string',
        enum: [
          'style',
          'color',
          'chart',
          'landing',
          'product',
          'ux',
          'typography',
          'icons',
          'react',
          'web',
          'prompt',
          'ui-reasoning'
        ],
        description: 'Search domain (auto-detected from query if omitted)'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum results to return (default 10, max 50)'
      }
    },
    required: ['query']
  },
  annotations: {
    title: 'UI/UX Search',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function searchUiUx(args: {
  query: string;
  domain?: string;
  maxResults?: number;
}): Promise<ToolResult> {
  try {
    const service = getSearchService();
    const result = service.search(
      args.query,
      args.domain as SearchDomain | undefined,
      args.maxResults
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      content: [
        {
          type: 'text',
          text: `Error: Failed to search UI/UX data - ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}
