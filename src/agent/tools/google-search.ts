/**
 * google_search Tool - 웹 검색
 * Phase 3: Function Calling Tool Definitions
 *
 * Gemini webSearch() 활용
 */

import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS_LIMIT = 10;

export const googleSearchSchema = z.object({
  query: z.string().describe('Search query'),
  maxResults: z.number()
    .min(1)
    .max(MAX_RESULTS_LIMIT)
    .optional()
    .describe('Maximum number of results (1-10, default: 5)'),
});

async function handleGoogleSearch(args: Record<string, unknown>): Promise<string> {
  const { query, maxResults } = args as z.infer<typeof googleSearchSchema>;
  const limit = Math.min(maxResults ?? DEFAULT_MAX_RESULTS, MAX_RESULTS_LIMIT);

  try {
    const { webSearch } = await import('../../lib/gemini/capabilities.js');
    const prompt = `Search for: "${query}"\n\nReturn up to ${limit} results. For each result, include: title, URL, and a brief snippet.`;
    const result = await webSearch(prompt);
    return result || '(no results found)';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Search failed: ${msg}`;
  }
}

export const googleSearchTool: ToolRegistrationInput = {
  name: 'google_search',
  description: 'Search the web for information using Google Search via Gemini',
  schema: googleSearchSchema,
  handler: handleGoogleSearch,
  scope: 'read',
};
