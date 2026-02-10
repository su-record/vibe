/**
 * google_search Tool - 웹 검색
 * Phase 3: Function Calling Tool Definitions
 *
 * Gemini webSearch() 활용
 */

import type { ToolDefinition } from '../types.js';
import type { JsonSchema } from '../types.js';

const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS_LIMIT = 10;

const googleSearchParameters: JsonSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search query' },
    maxResults: { type: 'number', minimum: 1, maximum: 10, description: 'Maximum number of results (1-10, default: 5)' },
  },
  required: ['query'],
};

async function handleGoogleSearch(args: Record<string, unknown>): Promise<string> {
  const { query, maxResults } = args as { query: string; maxResults?: number };
  const limit = Math.min(maxResults ?? DEFAULT_MAX_RESULTS, MAX_RESULTS_LIMIT);

  try {
    const { webSearch } = await import('../../infra/lib/gemini/capabilities.js');
    const prompt = `Search for: "${query}"\n\nReturn up to ${limit} results. For each result, include: title, URL, and a brief snippet.`;
    const result = await webSearch(prompt);
    return result || '(no results found)';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Search failed: ${msg}`;
  }
}

export const googleSearchTool: ToolDefinition = {
  name: 'google_search',
  description: 'Search the web for information using Google Search via Gemini',
  parameters: googleSearchParameters,
  handler: handleGoogleSearch,
  scope: 'read',
};
