/**
 * TranslationService - LLM-based translation with auto language detection
 * Supports chunking for long texts
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

const CHUNK_CHARS = 16_000; // ~4000 tokens

export class TranslationService {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Translate text with auto language detection */
  async translate(text: string, targetLang?: string): Promise<string> {
    if (text.length <= CHUNK_CHARS) {
      return this.translateChunk(text, targetLang);
    }
    return this.translateWithChunking(text, targetLang);
  }

  /** Detect source language */
  async detectLanguage(text: string): Promise<string> {
    const sample = text.slice(0, 200);
    const hasKorean = /[가-힣]/.test(sample);
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(sample);
    const hasChinese = /[\u4E00-\u9FFF]/.test(sample);

    if (hasKorean) return 'ko';
    if (hasJapanese) return 'ja';
    if (hasChinese) return 'zh';
    return 'en';
  }

  private async translateChunk(text: string, targetLang?: string): Promise<string> {
    const sourceLang = await this.detectLanguage(text);
    const target = targetLang ?? this.getDefaultTarget(sourceLang);
    const result = await this.smartRouter.route({
      type: 'general',
      systemPrompt: this.buildSystemPrompt(sourceLang, target),
      prompt: text,
    });
    if (!result.success) {
      throw new Error('번역에 실패했습니다.');
    }
    return result.content;
  }

  private async translateWithChunking(text: string, targetLang?: string): Promise<string> {
    const chunks = this.splitIntoChunks(text);
    this.logger('info', `번역 청킹: ${chunks.length}개 청크`);
    const translated: string[] = [];
    for (const chunk of chunks) {
      const result = await this.translateChunk(chunk, targetLang);
      translated.push(result);
    }
    return translated.join('\n');
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_CHARS) {
      chunks.push(text.slice(i, i + CHUNK_CHARS));
    }
    return chunks;
  }

  private getDefaultTarget(sourceLang: string): string {
    return sourceLang === 'ko' ? 'en' : 'ko';
  }

  private buildSystemPrompt(sourceLang: string, targetLang: string): string {
    const langNames: Record<string, string> = {
      ko: '한국어', en: '영어', ja: '일본어', zh: '중국어',
    };
    const source = langNames[sourceLang] ?? sourceLang;
    const target = langNames[targetLang] ?? targetLang;
    return `${source}를 ${target}로 자연스럽게 번역하세요. 번역 결과만 반환하세요.`;
  }
}
