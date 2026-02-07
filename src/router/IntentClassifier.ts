/**
 * IntentClassifier - 3-stage hybrid intent classification
 * 1. Explicit command prefix matching
 * 2. Keyword heuristic (Korean + English)
 * 3. LLM fallback (SmartRouter)
 */

import { InterfaceLogger } from '../interface/types.js';
import { ClassifiedIntent, IntentCategory, SmartRouterLike } from './types.js';

const CONFIDENCE_THRESHOLD = 0.7;

const VALID_CATEGORIES: ReadonlySet<string> = new Set<IntentCategory>([
  'development', 'google', 'research', 'utility',
  'monitor', 'composite', 'conversation',
]);

/** Command prefix → category mapping */
const COMMAND_PREFIX_MAP: Record<string, IntentCategory> = {
  '/dev': 'development',
  '/google': 'google',
  '/search': 'research',
  '/util': 'utility',
  '/monitor': 'monitor',
};

/** Category → keyword lists (Korean + English) */
const KEYWORD_MAP: Record<IntentCategory, readonly string[]> = {
  development: [
    '코딩', '개발', '버그', '수정', '테스트', '커밋', '푸시', 'PR', '코드',
    '리팩토링', 'code', 'dev', 'fix', 'test', 'commit', 'push', 'pull request',
    'debug', 'deploy', '배포', '빌드', 'build',
  ],
  google: [
    '메일', '이메일', '드라이브', '스프레드시트', '시트', '캘린더', '일정',
    '유튜브', 'gmail', 'drive', 'sheets', 'calendar', 'youtube', 'email',
  ],
  research: [
    '검색', '찾아', '조사', '리서치', '요약', '북마크',
    'search', 'find', 'research', 'summarize', 'bookmark',
  ],
  utility: [
    '이미지', '번역', '메모', '스크린샷', 'PDF', '문서',
    'image', 'translate', 'memo', 'screenshot', 'document', 'note',
  ],
  monitor: [
    '스케줄', '매일', '매주', '모니터', '알림', '리포트',
    'schedule', 'daily', 'weekly', 'monitor', 'alert', 'report', 'cron',
  ],
  composite: [],
  conversation: [],
};

export class IntentClassifier {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike | null;

  constructor(logger: InterfaceLogger, smartRouter?: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter ?? null;
  }

  /** Set SmartRouter (for deferred initialization) */
  setSmartRouter(router: SmartRouterLike): void {
    this.smartRouter = router;
  }

  /** Classify message intent using 3-stage pipeline */
  async classify(text: string): Promise<ClassifiedIntent> {
    const trimmed = text.trim();

    // Stage 1: Explicit command prefix
    const explicit = this.matchCommandPrefix(trimmed);
    if (explicit) return explicit;

    // Stage 2: Keyword heuristic
    const heuristic = this.matchKeywords(trimmed);
    if (heuristic && heuristic.confidence >= CONFIDENCE_THRESHOLD) {
      return heuristic;
    }

    // Stage 3: LLM fallback (only when heuristic is below threshold)
    const llmResult = await this.classifyWithLLM(trimmed);
    if (llmResult) return llmResult;

    // Use best heuristic if available (even if below threshold)
    if (heuristic) return heuristic;

    // Final fallback: conversation
    return this.createConversationFallback(trimmed);
  }

  /** Stage 1: Match explicit command prefixes */
  private matchCommandPrefix(text: string): ClassifiedIntent | null {
    for (const [prefix, category] of Object.entries(COMMAND_PREFIX_MAP)) {
      if (text.startsWith(prefix)) {
        const rawQuery = text.slice(prefix.length).trim();
        return {
          category,
          confidence: 1.0,
          rawQuery: rawQuery || text,
        };
      }
    }
    return null;
  }

  /** Stage 2: Keyword-based heuristic classification */
  private matchKeywords(text: string): ClassifiedIntent | null {
    const lower = text.toLowerCase();
    const scores = new Map<IntentCategory, number>();

    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
      if (category === 'composite' || category === 'conversation') continue;

      const matchCount = keywords.filter((kw) => this.matchKeyword(lower, kw.toLowerCase())).length;
      if (matchCount > 0) {
        scores.set(category as IntentCategory, matchCount);
      }
    }

    if (scores.size === 0) return null;

    // Check for composite intent (2+ categories matched)
    if (scores.size >= 2) {
      return this.buildCompositeIntent(text, scores);
    }

    // Single category match
    const [bestCategory, matchCount] = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    const confidence = Math.min(0.5 + matchCount * 0.2, 0.95);

    return {
      category: bestCategory,
      confidence,
      rawQuery: text,
    };
  }

  /** Match a keyword with word boundary for ASCII, substring for Korean */
  private matchKeyword(text: string, keyword: string): boolean {
    const isAscii = /^[a-z\s]+$/.test(keyword);
    if (isAscii) {
      const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`);
      return regex.test(text);
    }
    return text.includes(keyword);
  }

  /** Escape regex special characters */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Build composite intent from multiple category matches */
  private buildCompositeIntent(
    text: string,
    scores: Map<IntentCategory, number>,
  ): ClassifiedIntent {
    const subIntents = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        confidence: Math.min(0.5 + count * 0.15, 0.95),
      }));

    return {
      category: 'composite',
      confidence: 0.85,
      rawQuery: text,
      subIntents,
    };
  }

  /** Stage 3: LLM-based classification */
  private async classifyWithLLM(text: string): Promise<ClassifiedIntent | null> {
    if (!this.smartRouter) return null;

    try {
      const result = await this.smartRouter.route({
        type: 'reasoning',
        systemPrompt: LLM_CLASSIFY_SYSTEM_PROMPT,
        prompt: `Classify this message into one category: "${text}"\nReturn ONLY the category name.`,
      });

      if (!result.success) return null;

      const category = result.content.trim().toLowerCase();
      if (!VALID_CATEGORIES.has(category)) {
        this.logger('warn', `LLM returned invalid category: ${category}`);
        return null;
      }

      return {
        category: category as IntentCategory,
        confidence: 0.75,
        rawQuery: text,
      };
    } catch (err) {
      this.logger('warn', 'LLM classification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** Create conversation fallback */
  private createConversationFallback(text: string): ClassifiedIntent {
    return {
      category: 'conversation',
      confidence: 0.5,
      rawQuery: text,
    };
  }
}

const LLM_CLASSIFY_SYSTEM_PROMPT = `You are an intent classifier. Classify the user message into exactly one of these categories:
- development: coding, debugging, testing, git operations
- google: gmail, drive, sheets, calendar, youtube
- research: web search, summarization, bookmarks
- utility: translation, notes, screenshots, image generation, file analysis
- monitor: scheduling, alerts, reports, github monitoring
- composite: multiple categories combined (e.g., "search and email")
- conversation: general chat, greetings, questions

Return ONLY the category name, nothing else.`;
