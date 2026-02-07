/**
 * ContentSummarizer - URL content extraction + LLM summarization
 * Supports chunking for long content (4000 token units)
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

const CHUNK_SIZE = 4000; // tokens (~16000 chars as rough estimate)
const CHARS_PER_TOKEN = 4; // rough estimate
const MAX_CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN;

export type SummaryLength = 'short' | 'medium' | 'detailed';

export interface SummaryResult {
  title: string;
  summary: string;
  tags: string[];
  url: string;
}

export class ContentSummarizer {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Fetch URL content and summarize */
  async summarizeUrl(url: string, length: SummaryLength = 'medium'): Promise<SummaryResult> {
    const { title, text } = await this.fetchContent(url);
    const summary = await this.summarizeText(text, length);
    const tags = await this.generateTags(text);
    return { title, summary, tags, url };
  }

  /** Summarize plain text */
  async summarizeText(text: string, length: SummaryLength = 'medium'): Promise<string> {
    if (text.length <= MAX_CHUNK_CHARS) {
      return this.summarizeChunk(text, length);
    }
    return this.summarizeWithChunking(text, length);
  }

  /** Generate tags from content via LLM */
  async generateTags(text: string): Promise<string[]> {
    const snippet = text.slice(0, 2000);
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: '주어진 텍스트에서 핵심 태그 3-5개를 추출하세요. 콤마로 구분된 태그만 반환하세요.',
      prompt: snippet,
    });
    if (!result.success) return [];
    return result.content.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
  }

  private async fetchContent(url: string): Promise<{ title: string; text: string }> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VibBot/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`페이지 로드 실패 (${res.status}): ${url}`);
    }
    const html = await res.text();
    return { title: this.extractTitle(html), text: this.htmlToText(html) };
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match?.[1]?.trim() ?? '(제목 없음)';
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async summarizeChunk(text: string, length: SummaryLength): Promise<string> {
    const lengthGuide = this.getLengthGuide(length);
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: `한국어로 요약하세요. ${lengthGuide}`,
      prompt: text.slice(0, MAX_CHUNK_CHARS),
    });
    if (!result.success) {
      throw new Error('요약 생성 실패');
    }
    return result.content;
  }

  private async summarizeWithChunking(text: string, length: SummaryLength): Promise<string> {
    const chunks = this.splitIntoChunks(text);
    this.logger('info', `콘텐츠 청킹: ${chunks.length}개 청크`);

    const chunkSummaries: string[] = [];
    for (const chunk of chunks) {
      const summary = await this.summarizeChunk(chunk, 'short');
      chunkSummaries.push(summary);
    }

    // Final integration summary
    const combined = chunkSummaries.join('\n\n');
    return this.summarizeChunk(combined, length);
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += MAX_CHUNK_CHARS) {
      chunks.push(text.slice(i, i + MAX_CHUNK_CHARS));
    }
    return chunks;
  }

  private getLengthGuide(length: SummaryLength): string {
    switch (length) {
      case 'short': return '3줄 이내로 핵심만 요약하세요.';
      case 'medium': return '10줄 이내로 주요 내용을 요약하세요.';
      case 'detailed': return '상세하게 모든 핵심 내용을 포함하여 요약하세요.';
    }
  }
}
