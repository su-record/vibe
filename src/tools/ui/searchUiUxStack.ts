// UI/UX Stack Search Tool - Framework-specific implementation guidelines

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { SearchService } from '../../lib/ui-ux/SearchService.js';

// Singleton SearchService instance
let searchService: SearchService | null = null;

function getSearchService(): SearchService {
  if (!searchService) {
    searchService = new SearchService();
    searchService.initialize();
  }
  return searchService;
}

export const searchUiUxStackDefinition: ToolDefinition = {
  name: 'core_ui_stack_search',
  description: 'framework guide|stack guideline|nextjs guide|react guide|vue guide - Search framework-specific UI implementation guidelines (13 stacks: nextjs, react, shadcn, html-tailwind, svelte, vue, nuxtjs, nuxt-ui, astro, flutter, react-native, swiftui, jetpack-compose)',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "form validation", "routing", "state management")'
      },
      stack: {
        type: 'string',
        enum: [
          'nextjs',
          'react',
          'shadcn',
          'html-tailwind',
          'svelte',
          'vue',
          'nuxtjs',
          'nuxt-ui',
          'astro',
          'flutter',
          'react-native',
          'swiftui',
          'jetpack-compose'
        ],
        description: 'Target framework/stack'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum results to return (default 10, max 50)'
      }
    },
    required: ['query', 'stack']
  },
  annotations: {
    title: 'UI/UX Stack Search',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function searchUiUxStack(args: {
  query: string;
  stack: string;
  maxResults?: number;
}): Promise<ToolResult> {
  try {
    const service = getSearchService();
    const result = service.searchStack(args.query, args.stack, args.maxResults);

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
          text: `Error: Failed to search stack guidelines - ${errorMessage}`
        }
      ],
      isError: true
    };
  }
}
