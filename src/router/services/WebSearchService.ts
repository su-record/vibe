/**
 * WebSearchService - Web search via LLM (Gemini web search) + Playwright fallback
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

const MAX_RESULTS = 20;
const DEFAULT_RESULTS = 5;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchService {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Search the web using LLM (Gemini web search primary) */
  async search(query: string, maxResults: number = DEFAULT_RESULTS): Promise<SearchResult[]> {
    const count = Math.min(maxResults, MAX_RESULTS);
    try {
      return await this.searchViaLLM(query, count);
    } catch (err) {
      this.logger('warn', 'LLM 웹서치 실패, fallback 없음', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private async searchViaLLM(query: string, count: number): Promise<SearchResult[]> {
    const result = await this.smartRouter.route({
      type: 'web-search',
      systemPrompt: SEARCH_SYSTEM_PROMPT,
      prompt: `Search: "${query}"\nReturn top ${count} results as JSON array: [{"title":"...","url":"...","snippet":"..."}]`,
    });
    if (!result.success) {
      throw new Error('웹서치 LLM 응답 실패');
    }
    return this.parseSearchResults(result.content, count);
  }

  private parseSearchResults(content: string, maxCount: number): SearchResult[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return this.fallbackParse(content, maxCount);
      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      return parsed
        .filter((item): item is Record<string, string> =>
          typeof item === 'object' && item !== null && 'title' in item && 'url' in item,
        )
        .slice(0, maxCount)
        .map((item) => ({
          title: String(item.title ?? ''),
          url: String(item.url ?? ''),
          snippet: String(item.snippet ?? ''),
        }));
    } catch {
      return this.fallbackParse(content, maxCount);
    }
  }

  /** Fallback: parse unstructured LLM response */
  private fallbackParse(content: string, maxCount: number): SearchResult[] {
    const urlPattern = /https?:\/\/[^\s)>\]]+/g;
    const urls = content.match(urlPattern) ?? [];
    return urls.slice(0, maxCount).map((url) => ({
      title: url,
      url,
      snippet: '',
    }));
  }

  /** Format search results for Telegram */
  static formatResults(results: SearchResult[]): string {
    if (results.length === 0) return '검색 결과가 없습니다.';
    return results
      .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n${r.snippet}`)
      .join('\n\n');
  }
}

const SEARCH_SYSTEM_PROMPT = `You are a web search assistant. Search the web for the user's query and return results as a JSON array.
Each result must have: title, url, snippet.
Return ONLY the JSON array, no other text.`;
