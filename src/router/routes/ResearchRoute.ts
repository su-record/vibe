/**
 * ResearchRoute - Web search, summarization, bookmarks
 * Routes research-category intents to appropriate services
 */

import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult, SmartRouterLike } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { WebSearchService } from '../services/WebSearchService.js';
import { ContentSummarizer } from '../services/ContentSummarizer.js';
import { BookmarkService } from '../services/BookmarkService.js';

type ResearchSubIntent = 'web_search' | 'summarize' | 'bookmark' | 'bookmark_list';

const SUB_INTENT_KEYWORDS: Record<ResearchSubIntent, readonly string[]> = {
  web_search: ['검색', '찾아', 'search', 'find', '뉴스', '정보'],
  summarize: ['요약', 'summarize', 'summary', '정리'],
  bookmark: ['북마크', 'bookmark', '저장', '즐겨찾기'],
  bookmark_list: ['북마크 목록', '저장한 것', '즐겨찾기 목록'],
};

export class ResearchRoute extends BaseRoute {
  readonly name = 'research';
  private searchService: WebSearchService;
  private summarizer: ContentSummarizer;
  private bookmarkService: BookmarkService;

  constructor(
    logger: InterfaceLogger,
    smartRouter: SmartRouterLike,
    bookmarkService?: BookmarkService,
  ) {
    super(logger);
    this.searchService = new WebSearchService(logger, smartRouter);
    this.summarizer = new ContentSummarizer(logger, smartRouter);
    this.bookmarkService = bookmarkService ?? new BookmarkService(logger);
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'research';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    const query = context.intent.rawQuery;
    const subIntent = this.classifySubIntent(query);
    this.logger('info', `Research sub-intent: ${subIntent}`);

    try {
      switch (subIntent) {
        case 'web_search': return await this.handleSearch(query);
        case 'summarize': return await this.handleSummarize(query);
        case 'bookmark': return await this.handleBookmark(query);
        case 'bookmark_list': return await this.handleBookmarkList(query);
        default: return await this.handleSearch(query);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  private async handleSearch(query: string): Promise<RouteResult> {
    const cleaned = this.removeKeywords(query, ['검색', '찾아', '해줘', '알려줘']);
    const results = await this.searchService.search(cleaned);
    return { success: true, data: WebSearchService.formatResults(results) };
  }

  private async handleSummarize(query: string): Promise<RouteResult> {
    const url = this.extractUrl(query);
    if (url) {
      const result = await this.summarizer.summarizeUrl(url);
      return { success: true, data: `제목: ${result.title}\n\n${result.summary}\n\n태그: ${result.tags.join(', ')}` };
    }
    const textToSummarize = this.removeKeywords(query, ['요약', '정리', '해줘']);
    const summary = await this.summarizer.summarizeText(textToSummarize);
    return { success: true, data: summary };
  }

  private async handleBookmark(query: string): Promise<RouteResult> {
    const url = this.extractUrl(query);
    if (!url) {
      return { success: false, error: 'URL을 포함해주세요.' };
    }
    const summary = await this.summarizer.summarizeUrl(url);
    const id = this.bookmarkService.save(url, summary.title, summary.summary, summary.tags);
    return { success: true, data: `북마크 저장됨 (#${id})\n제목: ${summary.title}\n태그: ${summary.tags.join(', ')}` };
  }

  private async handleBookmarkList(query: string): Promise<RouteResult> {
    const bookmarks = this.bookmarkService.list(undefined, 10);
    if (bookmarks.length === 0) {
      return { success: true, data: '저장된 북마크가 없습니다.' };
    }
    const formatted = bookmarks
      .map((b, i) => `${i + 1}. ${b.title}\n   ${b.url}\n   태그: ${b.tags}`)
      .join('\n\n');
    return { success: true, data: `북마크 목록:\n\n${formatted}` };
  }

  private classifySubIntent(text: string): ResearchSubIntent {
    const lower = text.toLowerCase();
    // Check for URL first → summarize or bookmark
    if (this.extractUrl(text)) {
      if (/북마크|bookmark|저장/.test(lower)) return 'bookmark';
      if (/요약|summary|summarize/.test(lower)) return 'summarize';
      return 'bookmark'; // Default for URLs
    }
    // Check compound keywords first (bookmark_list before bookmark)
    if (/북마크\s*목록|즐겨찾기\s*목록|저장한\s*것|bookmark\s*list/i.test(lower)) return 'bookmark_list';
    for (const [intent, keywords] of Object.entries(SUB_INTENT_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        return intent as ResearchSubIntent;
      }
    }
    return 'web_search';
  }

  private extractUrl(text: string): string | null {
    const match = text.match(/https?:\/\/[^\s)>\]]+/);
    return match?.[0] ?? null;
  }

  private removeKeywords(text: string, keywords: string[]): string {
    let result = text;
    for (const kw of keywords) {
      result = result.replace(new RegExp(kw, 'gi'), '');
    }
    return result.replace(/\s+/g, ' ').trim() || text;
  }
}
