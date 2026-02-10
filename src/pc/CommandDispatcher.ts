/**
 * Command Dispatcher — Phase 6-1
 *
 * GPT-based intent classification → module routing.
 * GPT가 사용자 메시지를 이해하고 적절한 모듈로 라우팅한다.
 * Supports compound commands (multi-step chains).
 */

import type {
  ClassifiedIntent,
  IntentCategory,
  CommandResult,
  CompoundResult,
  IntegrationLogger,
} from './types.js';
import type { ModuleRegistry } from './ModuleRegistry.js';
import type { SessionContextManager } from './SessionContext.js';
import { coreGptOrchestrate } from '../infra/lib/gpt/orchestration.js';

// ============================================================================
// Module Descriptions (GPT classification prompt)
// ============================================================================

const MODULE_DESCRIPTIONS: Record<IntentCategory, string> = {
  browser: 'Chrome 브라우저 조작 — 웹사이트 열기, 클릭, 스크롤, 스크린샷, 로그인 필요 사이트 접근',
  google: 'Gemini API — 웹 검색, YouTube 분석, 요약, 번역, 텍스트/이미지 분석',
  voice: '음성 처리 — TTS(텍스트→음성), STT(음성→텍스트), 음성 명령',
  vision: '화면 인식 — Gemini Live 실시간 화면 분석, OS 스크린 캡처 + 분석',
  sandbox: '코드 실행 — Docker 컨테이너에서 코드 실행, 개발 환경',
  general: '일반 대화 — 위 카테고리에 해당하지 않는 일반 질문이나 대화',
};

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier for a PC control agent.
Classify the user's message into exactly one category.

Available categories:
${Object.entries(MODULE_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Rules:
- 웹 검색, 요약, 번역, YouTube → google (Gemini API 직접 처리)
- 브라우저 열기, 사이트 조작, 스크린샷 → browser
- 화면 캡처, 실시간 화면 분석 → vision
- 음성 합성/인식 → voice
- 코드 실행, 컨테이너 → sandbox
- 그 외 → general

Respond with JSON only: { "category": "...", "confidence": 0.0-1.0 }`;

// ============================================================================
// Classifier Function Type (for DI / testing)
// ============================================================================

export type IntentClassifyFn = (input: string) => Promise<ClassifiedIntent>;

/** Default GPT-based intent classifier */
export async function gptClassifyIntent(input: string): Promise<ClassifiedIntent> {
  try {
    const result = await coreGptOrchestrate(
      `사용자 메시지: "${input}"`,
      CLASSIFICATION_SYSTEM_PROMPT,
      { maxTokens: 128, jsonMode: true },
    );

    const parsed = JSON.parse(result) as { category?: string; confidence?: number };
    const validCategories: IntentCategory[] = [
      'browser', 'google', 'voice', 'vision', 'sandbox', 'general',
    ];

    const category = validCategories.includes(parsed.category as IntentCategory)
      ? (parsed.category as IntentCategory)
      : 'general';

    return {
      category,
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(Math.max(parsed.confidence, 0), 1)
        : 0.8,
    };
  } catch {
    // GPT 실패 시 general fallback
    return { category: 'general', confidence: 0.5 };
  }
}

// ============================================================================
// Command Dispatcher
// ============================================================================

export class CommandDispatcher {
  private registry: ModuleRegistry;
  private context: SessionContextManager;
  private logger: IntegrationLogger;
  private classify: IntentClassifyFn;

  constructor(
    registry: ModuleRegistry,
    context: SessionContextManager,
    logger: IntegrationLogger,
    classify?: IntentClassifyFn,
  ) {
    this.registry = registry;
    this.context = context;
    this.logger = logger;
    this.classify = classify ?? gptClassifyIntent;
  }

  /** Classify intent via GPT (or injected classifier) */
  async classifyIntent(input: string): Promise<ClassifiedIntent> {
    return this.classify(input);
  }

  /** Detect if input contains compound commands */
  isCompound(input: string): boolean {
    const compoundMarkers = ['그리고', '하고', '다음에', '후에', 'and then', 'then', 'after that'];
    const lower = input.toLowerCase();
    return compoundMarkers.some(marker => lower.includes(marker));
  }

  /** Execute a single command via the appropriate module */
  async dispatch(
    input: string,
    userId: string,
    channel: string,
  ): Promise<CommandResult> {
    const start = Date.now();
    const intent = await this.classifyIntent(input);

    // Check module availability
    if (intent.category !== 'general' && !this.registry.isEnabled(intent.category)) {
      return {
        success: false,
        module: intent.category,
        error: `${intent.category} 모듈이 비활성화되어 있습니다. 'vibe pc modules'로 확인하세요.`,
        durationMs: Date.now() - start,
      };
    }

    // Log to context
    this.context.addEntry(userId, channel, {
      module: intent.category,
      action: 'command',
      summary: input.slice(0, 100),
    });

    this.logger('info', `Dispatch: ${intent.category} (${intent.confidence.toFixed(2)}) → "${input.slice(0, 80)}"`);

    return {
      success: true,
      module: intent.category,
      data: { intent, input },
      durationMs: Date.now() - start,
    };
  }

  /** Execute compound command (multi-step) */
  async dispatchCompound(
    input: string,
    userId: string,
    channel: string,
  ): Promise<CompoundResult> {
    const start = Date.now();
    const parts = this.splitCompound(input);
    const results: CommandResult[] = [];

    for (const part of parts) {
      const result = await this.dispatch(part.trim(), userId, channel);
      results.push(result);
      if (!result.success) break; // Stop on first failure
    }

    return {
      steps: results,
      totalDurationMs: Date.now() - start,
      partialSuccess: results.some(r => r.success) && results.some(r => !r.success),
    };
  }

  /** Split compound input into parts */
  private splitCompound(input: string): string[] {
    const splitters = /(?:그리고|하고|다음에|후에|and then|then|after that)/gi;
    return input.split(splitters).map(s => s.trim()).filter(Boolean);
  }
}
