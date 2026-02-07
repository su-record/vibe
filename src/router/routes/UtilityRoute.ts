/**
 * UtilityRoute - Translation, notes, screenshots, file analysis, etc.
 * Routes utility-category intents to appropriate services
 */

import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult, SmartRouterLike } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { TranslationService } from '../services/TranslationService.js';
import { ImageGenerator } from '../services/ImageGenerator.js';
import { DocumentGenerator } from '../services/DocumentGenerator.js';
import { NoteService } from '../services/NoteService.js';
import { FileAnalyzer } from '../services/FileAnalyzer.js';

type UtilitySubIntent =
  | 'translate' | 'image_generate' | 'document_write'
  | 'note_save' | 'note_search' | 'screenshot' | 'file_analyze';

const SUB_INTENT_KEYWORDS: Record<UtilitySubIntent, readonly string[]> = {
  translate: ['번역', 'translate', '번역해'],
  image_generate: ['이미지', '그림', '생성', 'image', 'generate', '그려'],
  document_write: ['문서', '작성', '보고서', 'document', 'write', 'report'],
  note_save: ['메모', 'memo', 'note', '기록'],
  note_search: ['메모 찾', '메모 검색', '메모 목록', 'note search', 'note list'],
  screenshot: ['스크린샷', 'screenshot', '캡처', 'capture'],
  file_analyze: ['분석', 'analyze', '파일', 'file'],
};

export class UtilityRoute extends BaseRoute {
  readonly name = 'utility';
  private translation: TranslationService;
  private imageGen: ImageGenerator;
  private docGen: DocumentGenerator;
  private noteService: NoteService;
  private fileAnalyzer: FileAnalyzer;

  constructor(
    logger: InterfaceLogger,
    smartRouter: SmartRouterLike,
    noteService?: NoteService,
  ) {
    super(logger);
    this.translation = new TranslationService(logger, smartRouter);
    this.imageGen = new ImageGenerator(logger, smartRouter);
    this.docGen = new DocumentGenerator(logger, smartRouter);
    this.noteService = noteService ?? new NoteService(logger, undefined, smartRouter);
    this.fileAnalyzer = new FileAnalyzer(logger, smartRouter);
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'utility';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    const query = context.intent.rawQuery;
    const subIntent = this.classifySubIntent(query);
    this.logger('info', `Utility sub-intent: ${subIntent}`);

    try {
      switch (subIntent) {
        case 'translate': return await this.handleTranslate(query);
        case 'image_generate': return await this.handleImageGenerate(query);
        case 'document_write': return await this.handleDocumentWrite(query);
        case 'note_save': return await this.handleNoteSave(query);
        case 'note_search': return await this.handleNoteSearch(query);
        case 'screenshot': return await this.handleScreenshot(query);
        case 'file_analyze': return await this.handleFileAnalyze(query);
        default: return await this.handleTranslate(query);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  private async handleTranslate(query: string): Promise<RouteResult> {
    const text = this.extractTranslationText(query);
    const translated = await this.translation.translate(text);
    return { success: true, data: translated };
  }

  private async handleImageGenerate(query: string): Promise<RouteResult> {
    const prompt = this.removeKeywords(query, ['이미지', '그림', '생성', '만들어', '그려줘']);
    const result = await this.imageGen.generate(prompt);
    const data = result.url
      ? `이미지 생성 완료: ${result.url}`
      : `이미지 설명: ${result.description}`;
    return { success: true, data };
  }

  private async handleDocumentWrite(query: string): Promise<RouteResult> {
    const description = this.removeKeywords(query, ['문서', '작성', '보고서', '만들어', '써줘']);
    const doc = await this.docGen.generate(description);
    return { success: true, data: `${doc.title}\n\n${doc.content}` };
  }

  private async handleNoteSave(query: string): Promise<RouteResult> {
    const content = this.extractNoteContent(query);
    const note = await this.noteService.save(content);
    const tags = note.tags ? ` [태그: ${note.tags}]` : '';
    return { success: true, data: `메모 저장됨 (#${note.id})${tags}` };
  }

  private async handleNoteSearch(query: string): Promise<RouteResult> {
    const searchQuery = this.removeKeywords(query, ['메모', '찾아', '검색', '목록', '보여줘']);
    const hasSearchTerms = searchQuery && searchQuery !== query;
    const notes = hasSearchTerms ? this.noteService.search(searchQuery) : this.noteService.list();
    if (notes.length === 0) {
      return { success: true, data: '메모가 없습니다.' };
    }
    const formatted = notes
      .map((n, i) => `${i + 1}. ${n.content.slice(0, 100)}${n.tags ? `\n   태그: ${n.tags}` : ''}`)
      .join('\n\n');
    return { success: true, data: `메모 목록:\n\n${formatted}` };
  }

  private async handleScreenshot(query: string): Promise<RouteResult> {
    const url = this.extractUrl(query);
    if (!url) {
      return { success: false, error: 'URL을 포함해주세요.' };
    }
    // ScreenshotService requires BrowserPool (not always available)
    return { success: false, error: '스크린샷: Playwright 브라우저가 필요합니다.' };
  }

  private async handleFileAnalyze(query: string): Promise<RouteResult> {
    return { success: false, error: '파일 분석: 텔레그램에서 파일을 첨부하여 보내주세요.' };
  }

  private classifySubIntent(text: string): UtilitySubIntent {
    const lower = text.toLowerCase();
    // Check note_search first (more specific compound patterns)
    if (/메모\s*(찾|검색|목록)/.test(text) || /note\s*(search|list)/i.test(text)) return 'note_search';
    // Then check note_save pattern (메모: ...)
    if (/^메모[\s:：]/.test(text) || /^memo[\s:：]/i.test(text)) return 'note_save';

    for (const [intent, keywords] of Object.entries(SUB_INTENT_KEYWORDS)) {
      if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        return intent as UtilitySubIntent;
      }
    }
    return 'translate';
  }

  private extractTranslationText(query: string): string {
    // Pattern: "번역해줘: text" or "번역: text"
    const colonMatch = query.match(/번역[해하]?[줘:]?\s*[:：]\s*([\s\S]+)/);
    if (colonMatch) return colonMatch[1].trim();
    return this.removeKeywords(query, ['번역', '해줘', '해']);
  }

  private extractNoteContent(query: string): string {
    const match = query.match(/(?:메모|memo|note)\s*[:：]?\s*([\s\S]+)/i);
    return match?.[1]?.trim() ?? query;
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
